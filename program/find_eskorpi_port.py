#!/usr/bin/env python3
"""
Busca el puerto serie correcto de Eskorpi/Arduino probando todos los COM
disponibles y escuchando la firma del firmware.

Pensado para Windows + HC-05, pero tambien funciona en Linux si aparecen
puertos serie o RFCOMM.
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass, field

try:
    import serial
    import serial.tools.list_ports
except Exception as exc:  # pragma: no cover
    print("Falta pyserial. Instala con: pip install pyserial", file=sys.stderr)
    raise SystemExit(1) from exc


DEFAULT_BAUD = 19200
DEFAULT_LISTEN_SECONDS = 4.0

HANDSHAKE_RX = "HELLO:ESKORPI"
HANDSHAKE_TX = "WEBUI:OK"
HANDSHAKE_OK = "LINK:OK"

SIGNATURE_PREFIXES = (
    "STATUS:",
    "US:",
    "CLIMA:",
    "COLOR:",
)
SIGNATURE_EXACT = {
    "OBS_IR_IZQ",
    "OBS_IR_DER",
    "OBS_IR_BOTH",
    "OBS_ULTRA",
}


@dataclass
class ProbeResult:
    device: str
    description: str
    ok: bool = False
    handshake_seen: bool = False
    handshake_confirmed: bool = False
    telemetry_seen: bool = False
    lines: list[str] = field(default_factory=list)
    error: str | None = None

    @property
    def confidence(self) -> str:
        if self.handshake_confirmed:
            return "ALTA"
        if self.handshake_seen or self.telemetry_seen:
            return "MEDIA"
        if self.error:
            return "NULA"
        return "BAJA"


def normalize_port(port: str) -> str:
    upper_port = port.upper()
    if upper_port.startswith("COM"):
        suffix = upper_port[3:]
        if suffix.isdigit() and int(suffix) >= 10 and not port.startswith("\\\\.\\"):
            return f"\\\\.\\{upper_port}"
        return upper_port
    return port


def is_signature_line(line: str) -> bool:
    return line in SIGNATURE_EXACT or line.startswith(SIGNATURE_PREFIXES)


def list_ports() -> list[tuple[str, str]]:
    found = []
    for port in serial.tools.list_ports.comports():
        label_parts = [port.description or ""]
        if getattr(port, "hwid", ""):
            label_parts.append(port.hwid)
        found.append((port.device, " · ".join(part for part in label_parts if part)))
    return found


def probe_port(device: str, description: str, baudrate: int, listen_seconds: float) -> ProbeResult:
    result = ProbeResult(device=device, description=description)
    normalized = normalize_port(device)

    try:
        conn = serial.Serial(
            normalized,
            baudrate,
            timeout=0.35,
            write_timeout=1.5,
            inter_byte_timeout=0.2,
            rtscts=False,
            dsrdtr=False,
            xonxoff=False,
        )
    except Exception as exc:
        result.error = str(exc)
        return result

    try:
        try:
            conn.dtr = False
            conn.rts = False
        except Exception:
            pass

        try:
            conn.reset_input_buffer()
            conn.reset_output_buffer()
        except Exception:
            pass

        start = time.time()
        while time.time() - start < listen_seconds:
            raw = conn.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if not line:
                continue
            result.lines.append(line)

            if line == HANDSHAKE_RX:
                result.handshake_seen = True
                try:
                    conn.write(f"{HANDSHAKE_TX}\n".encode("utf-8"))
                except Exception as exc:
                    result.error = f"Recibi saludo, pero no pude responder: {exc}"
                    break
                continue

            if line == HANDSHAKE_OK:
                result.handshake_confirmed = True
                result.ok = True
                break

            if is_signature_line(line):
                result.telemetry_seen = True
                result.ok = True
    finally:
        try:
            conn.close()
        except Exception:
            pass

    return result


def print_header(baudrate: int, listen_seconds: float) -> None:
    print("Buscador de puertos Eskorpi")
    print(f"Baudrate: {baudrate}")
    print(f"Escucha por puerto: {listen_seconds:.1f}s")
    print("-" * 72)


def print_result(result: ProbeResult) -> None:
    print(f"Puerto: {result.device}")
    if result.description:
        print(f"Descripcion: {result.description}")
    print(f"Confianza: {result.confidence}")
    if result.error:
        print(f"Error: {result.error}")
    if result.lines:
        print("Lineas vistas:")
        for line in result.lines[:8]:
            print(f"  - {line}")
        if len(result.lines) > 8:
            print(f"  - ... ({len(result.lines)} lineas en total)")
    else:
        print("Lineas vistas: ninguna")
    print("-" * 72)


def print_summary(results: list[ProbeResult]) -> int:
    confirmed = [r for r in results if r.handshake_confirmed]
    probable = [r for r in results if not r.handshake_confirmed and r.ok]

    if confirmed:
        print("Puerto confirmado de Eskorpi:")
        for item in confirmed:
            print(f"  - {item.device} ({item.description or 'sin descripcion'})")
        return 0

    if probable:
        print("Puertos probables de Eskorpi (hay telemetria, pero no handshake completo):")
        for item in probable:
            print(f"  - {item.device} ({item.description or 'sin descripcion'})")
        print("Prueba primero esos COM en la WebUI.")
        return 0

    print("No se encontro un puerto que se comporte como Eskorpi.")
    print("Sugerencias:")
    print("  - Comprueba que el HC-05 este emparejado.")
    print("  - En Windows usa el COM de salida (Outgoing) del Bluetooth.")
    print("  - Verifica que el firmware nuevo este cargado y arrancado a 19200.")
    print("  - Si el robot usa otro baudrate, prueba --baud 9600 o similar.")
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prueba todos los puertos serie en busca de Eskorpi.")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD, help="Baudrate serie. Por defecto 19200.")
    parser.add_argument(
        "--listen",
        type=float,
        default=DEFAULT_LISTEN_SECONDS,
        help="Segundos de escucha por puerto. Por defecto 4.0.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ports = list_ports()

    print_header(args.baud, args.listen)
    if not ports:
        print("No hay puertos serie detectados.")
        return 1

    results: list[ProbeResult] = []
    for device, description in ports:
        print(f"Probando {device}...")
        result = probe_port(device, description, args.baud, args.listen)
        print_result(result)
        results.append(result)

    return print_summary(results)


if __name__ == "__main__":
    raise SystemExit(main())
