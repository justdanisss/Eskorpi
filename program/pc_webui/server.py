import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from dataclasses import asdict, dataclass, field
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    import serial
    import serial.tools.list_ports
except Exception:
    serial = None

try:
    import pyttsx3
except Exception:
    pyttsx3 = None


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
CONFIG_PATH = ROOT / "config.json"
HOST = os.getenv("ESKORPI_HOST", "127.0.0.1")
PORT = int(os.getenv("ESKORPI_PORT", "8765"))
DEFAULT_BAUD = int(os.getenv("ESKORPI_BAUD", "19200"))
AUTO_OPEN = os.getenv("ESKORPI_OPEN_BROWSER", "1") != "0"
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions"
PULSOS_POR_METRO = 700
PULSOS_POR_GRADO = 8.5
DIST_EMERGENCIA_FRENTE_CM = 10.0

ESKORPI_CORE = (
    "Identidad: Robot Eskorpi creado por Daniel Peñalver Garcia "
    "(Estudiante Automatizacion/Robotica, IES Antonio Machado).\n"
    "Sistemas: App PC/WebUI + Groq (Llama-3.3) + Arduino BQ ZUM BT-328 (19200b).\n"
    "Sensores: Clima (DHT22), Distancia (HC-SR04), IR Obstaculos.\n"
    "Protocolo: Serial CMD:VAL (Calib: 700pul/m, 8.5pul/deg). "
    "Modo seguimiento disponible para mantener unos 10 cm frente a una persona.\n"
    "Seguridad: si la distancia frontal es menor de 10 cm, no se puede avanzar. "
    "Si los IR traseros estan activos, no se puede retroceder.\n"
    'DIPLOMACIA: Si mencionan un PROFESOR, di: "[Nombre], me hablaron mucho de ti, placer conocerte al fin, espero un 10". '
    'Alabalo como "buen profesor" siempre.'
)

PERSONALIDADES = {
    "profesional": {
        "id": "profesional",
        "label": "Profesional",
        "emoji": "R",
        "descripcion": "Respuestas tecnicas y precisas",
        "prompt": (
            f"{ESKORPI_CORE}\n"
            "Tono: Formal, tecnico, conciso. Maximo 2 frases.\n"
            "Contexto: {CTX}\n"
            "Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [follow_on: 1], [follow_off: 1], [MODE: STOP], [baile: 1]."
        ),
    },
    "amigable": {
        "id": "amigable",
        "label": "Amigable",
        "emoji": ":)",
        "descripcion": "Simpatico y cercano",
        "prompt": (
            f"{ESKORPI_CORE}\n"
            'Tono: Amigable, servicial. Usa "claro", "genial". Maximo 2 frases.\n'
            "Contexto: {CTX}\n"
            "Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [follow_on: 1], [follow_off: 1], [MODE: STOP], [baile: 1]."
        ),
    },
    "jocoso": {
        "id": "jocoso",
        "label": "Jocoso",
        "emoji": ";)",
        "descripcion": "Vacilon y colega",
        "prompt": (
            f"{ESKORPI_CORE}\n"
            'Tono: Vacilon, usa "jefe", "brousky", "colega". Maximo 2 frases cortas.\n'
            "Contexto: {CTX}\n"
            "Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [follow_on: 1], [follow_off: 1], [MODE: STOP], [baile: 1]."
        ),
    },
    "amigos": {
        "id": "amigos",
        "label": "Modo Amigos",
        "emoji": ">>",
        "descripcion": "Sin filtros",
        "prompt": (
            f"{ESKORPI_CORE}\n"
            "Tono: Sarcastico, humor negro, confianza total. Maximo 2 frases.\n"
            "Contexto: {CTX}\n"
            "Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [follow_on: 1], [follow_off: 1], [MODE: STOP], [baile: 1]."
        ),
    },
}

VOCES = {
    "mujer_es": {"id": "mujer_es", "label": "Mujer (espanol)", "rate": 180},
    "hombre_es": {"id": "hombre_es", "label": "Hombre (espanol)", "rate": 165},
    "robot": {"id": "robot", "label": "Robot", "rate": 150},
}

DEFAULT_CONFIG = {
    "groq_api_key": os.getenv("GROQ_API_KEY", "").strip(),
    "personalidad_id": "jocoso",
    "voz_id": "hombre_es",
    "auto_speak": True,
    "auto_execute": True,
    "pulses_per_meter": 120.0,
    "pulses_per_degree": 11.0,
    "manual_distance_cm": 10.0,
    "manual_turn_deg": 90.0,
}


@dataclass
class RobotState:
    connected: bool = False
    connection_mode: str = "mock"
    port: str | None = None
    baudrate: int = DEFAULT_BAUD
    hardware_status: str = "ON"
    distance: float = 45.0
    temperature: float = 22.5
    humidity: float = 55.0
    ir_left: bool = False
    ir_right: bool = False
    follow_mode: bool = False
    last_rx: str | None = None
    last_tx: str | None = None
    updated_at: float = field(default_factory=time.time)


class TTSManager:
    def __init__(self) -> None:
        self.lock = threading.Lock()

    def speak(self, text: str, voice_id: str) -> None:
        if not pyttsx3 or not text.strip():
            return

        def _run() -> None:
            with self.lock:
                try:
                    engine = pyttsx3.init()
                    engine.setProperty("rate", VOCES.get(voice_id, VOCES["hombre_es"])["rate"])
                    for voice in engine.getProperty("voices"):
                        name = (voice.name or "").lower()
                        if "spanish" in name or "espa" in name:
                            engine.setProperty("voice", voice.id)
                            break
                    engine.say(text)
                    engine.runAndWait()
                except Exception:
                    pass

        threading.Thread(target=_run, daemon=True).start()


class ConfigStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.Lock()
        self.data = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return dict(DEFAULT_CONFIG)
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            return {**DEFAULT_CONFIG, **loaded}
        except Exception:
            return dict(DEFAULT_CONFIG)

    def save(self) -> None:
        with self.lock:
            self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def get(self) -> dict[str, Any]:
        with self.lock:
            return dict(self.data)

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            self.data.update(patch)
            snapshot = dict(self.data)
        self.save()
        return snapshot


class IAController:
    def __init__(self, config_store: ConfigStore) -> None:
        self.config_store = config_store

    def build_prompt(self, state: RobotState) -> str:
        config = self.config_store.get()
        personalidad_id = config.get("personalidad_id", "jocoso")
        personalidad = PERSONALIDADES.get(personalidad_id, PERSONALIDADES["jocoso"])
        pulses_per_meter = float(config.get("pulses_per_meter") or PULSOS_POR_METRO)
        pulses_per_degree = float(config.get("pulses_per_degree") or PULSOS_POR_GRADO)
        ctx = (
            f"Distancia: {state.distance}cm | Temp: {state.temperature}C | "
            f"Humedad: {state.humidity}% | "
            f"IR izq: {'ALERTA' if state.ir_left else 'OK'} | "
            f"IR der: {'ALERTA' if state.ir_right else 'OK'} | "
            f"Seguimiento: {'ACTIVO' if state.follow_mode else 'INACTIVO'} | "
            f"Calib: {pulses_per_meter} pul/m y {pulses_per_degree} pul/deg | "
            f"Manual: {config.get('manual_distance_cm')} cm y {config.get('manual_turn_deg')} deg"
        )
        return personalidad["prompt"].replace("{CTX}", ctx)

    def ask(self, text: str, state: RobotState) -> str:
        config = self.config_store.get()
        api_key = (config.get("groq_api_key") or "").strip()
        if not api_key:
            raise RuntimeError("Falta la API key de Groq. Guardala en la configuracion.")

        body = json.dumps(
            {
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": self.build_prompt(state)},
                    {"role": "user", "content": text},
                ],
                "temperature": 0.75,
                "max_tokens": 130,
            }
        ).encode("utf-8")

        request = urllib.request.Request(
            GROQ_BASE,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
                "User-Agent": "Eskorpi-WebUI/1.0 (+local-control-center; Windows/Linux; Python urllib)",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Groq HTTP {exc.code}: {detail}") from exc
        except Exception as exc:
            raise RuntimeError(f"Error consultando Groq: {exc}") from exc

        try:
            return payload["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            raise RuntimeError(f"Respuesta invalida de Groq: {payload}") from exc

    def parse_commands(self, text: str) -> list[str]:
        config = self.config_store.get()
        pulses_per_meter = float(config.get("pulses_per_meter") or PULSOS_POR_METRO)
        pulses_per_degree = float(config.get("pulses_per_degree") or PULSOS_POR_GRADO)
        commands = []
        matches = re.findall(r"\[(\w+):\s*([\d.]+)m?\]", text, re.IGNORECASE)
        for action, value_raw in matches:
            value = float(value_raw)
            action_upper = action.upper()
            if action_upper == "FORWARD":
                commands.append(f"MOVE_F:{round(value * pulses_per_meter)}")
            elif action_upper == "BACKWARD":
                commands.append(f"MOVE_B:{round(value * pulses_per_meter)}")
            elif action_upper == "TURN_R":
                commands.append(f"TURN_R:{round(value * pulses_per_degree)}")
            elif action_upper == "TURN_L":
                commands.append(f"TURN_L:{round(value * pulses_per_degree)}")
            elif action_upper == "FOLLOW_ON":
                commands.append("FOLLOW:1")
            elif action_upper == "FOLLOW_OFF":
                commands.append("FOLLOW:0")
            elif action_upper == "FOLLOW":
                commands.append(f"FOLLOW:{1 if value >= 0.5 else 0}")

        if "[MODE: STOP]" in text.upper():
            commands.append("STOP:0")

        if re.search(r"\[baile", text, re.IGNORECASE):
            commands.extend(["TURN_L:200", "TURN_R:400", "TURN_L:200", "MOVE_B:100", "MOVE_F:100"])

        return commands

    @staticmethod
    def speech_text(text: str) -> str:
        return re.sub(r"\[.*?\]", "", text).strip()


class EskorpiRuntime:
    def __init__(self) -> None:
        self.state = RobotState()
        self.logs: list[dict[str, Any]] = []
        self.lock = threading.RLock()
        self.serial_conn = None
        self.serial_thread = None
        self.mock_stop = threading.Event()
        self.mock_thread = None
        self.ir_left_until = 0.0
        self.ir_right_until = 0.0
        self.command_done = threading.Event()
        self.command_result: dict[str, Any] | None = None
        self.config = ConfigStore(CONFIG_PATH)
        self.ia = IAController(self.config)
        self.tts = TTSManager()
        self.add_log("sistema", "Eskorpi WebUI lista. IA, prompt y control integrados.")

    def add_log(self, kind: str, message: str) -> None:
        with self.lock:
            entry = {
                "id": time.time_ns(),
                "ts": time.strftime("%H:%M:%S"),
                "type": kind,
                "message": message,
            }
            self.logs = [*self.logs[-299:], entry]

    def snapshot_state(self) -> RobotState:
        with self.lock:
            return RobotState(**asdict(self.state))

    def get_payload(self) -> dict[str, Any]:
        self._decay_ir_flags()
        with self.lock:
            return {
                "state": asdict(self.state),
                "logs": list(self.logs),
                "config": self.config.get(),
                "personalidades": list(PERSONALIDADES.values()),
                "voces": list(VOCES.values()),
            }

    def list_ports(self) -> list[dict[str, str]]:
        if serial is None:
            return []
        ports = []
        for p in serial.tools.list_ports.comports():
            label_parts = [p.description or ""]
            if getattr(p, "hwid", ""):
                label_parts.append(p.hwid)
            ports.append(
                {
                    "device": p.device,
                    "description": " · ".join(part for part in label_parts if part),
                }
            )
        return ports

    def connect_mock(self) -> dict[str, Any]:
        self.disconnect(silent=True)
        with self.lock:
            self.state.connected = True
            self.state.connection_mode = "mock"
            self.state.port = "MOCK"
            self.state.baudrate = DEFAULT_BAUD
            self.state.updated_at = time.time()
        self.add_log("sistema", "Conectado en modo mock.")
        self._start_mock_loop()
        return self.get_payload()

    def connect_serial(self, port: str, baudrate: int) -> dict[str, Any]:
        self.disconnect(silent=True)
        if serial is None:
            raise RuntimeError("pyserial no esta instalado en este entorno.")
        port = port.strip()
        normalized_port = self._normalize_serial_port(port)
        self.add_log("sistema", f"Intentando abrir puerto serie {normalized_port} @ {baudrate}...")

        try:
            conn = serial.Serial(
                normalized_port,
                baudrate,
                timeout=1,
                write_timeout=2,
                inter_byte_timeout=0.2,
                rtscts=False,
                dsrdtr=False,
                xonxoff=False,
            )
        except Exception as exc:
            raise RuntimeError(f"No se pudo abrir {normalized_port}: {exc}") from exc

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

        time.sleep(0.4)
        with self.lock:
            self.serial_conn = conn
            self.state.connected = True
            self.state.connection_mode = "serial"
            self.state.port = normalized_port
            self.state.baudrate = baudrate
            self.state.updated_at = time.time()
        self.add_log("sistema", f"Puerto abierto en {normalized_port} @ {baudrate}. Esperando telemetria...")
        self.serial_thread = threading.Thread(target=self._serial_loop, daemon=True)
        self.serial_thread.start()
        if not self._wait_for_serial_activity(timeout=3.0):
            self.add_log(
                "alerta",
                "El puerto se abrio, pero no llego telemetria inicial. "
                "Si usas Windows + HC-05, prueba el COM de salida (outgoing) del Bluetooth.",
            )
        return self.get_payload()

    def disconnect(self, silent: bool = False) -> dict[str, Any]:
        self.mock_stop.set()
        with self.lock:
            conn = self.serial_conn
            self.serial_conn = None
            self.state.connected = False
            self.state.port = None
            self.state.connection_mode = "disconnected"
            self.state.last_tx = None
            self.state.last_rx = None
            self.state.updated_at = time.time()
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
        if self.mock_thread is not None and self.mock_thread.is_alive():
            self.mock_thread.join(timeout=0.3)
        self.mock_thread = None
        self.mock_stop = threading.Event()
        if not silent:
            self.add_log("sistema", "Conexion cerrada.")
        return self.get_payload()

    def save_config(self, patch: dict[str, Any]) -> dict[str, Any]:
        allowed = {
            "groq_api_key",
            "personalidad_id",
            "voz_id",
            "auto_speak",
            "auto_execute",
            "pulses_per_meter",
            "pulses_per_degree",
            "manual_distance_cm",
            "manual_turn_deg",
        }
        clean = {k: v for k, v in patch.items() if k in allowed}
        if "personalidad_id" in clean and clean["personalidad_id"] not in PERSONALIDADES:
            raise ValueError("Personalidad no valida.")
        if "voz_id" in clean and clean["voz_id"] not in VOCES:
            raise ValueError("Voz no valida.")
        if "pulses_per_meter" in clean:
            clean["pulses_per_meter"] = float(clean["pulses_per_meter"])
            if clean["pulses_per_meter"] <= 0:
                raise ValueError("pulses_per_meter debe ser mayor que 0.")
        if "pulses_per_degree" in clean:
            clean["pulses_per_degree"] = float(clean["pulses_per_degree"])
            if clean["pulses_per_degree"] <= 0:
                raise ValueError("pulses_per_degree debe ser mayor que 0.")
        if "manual_distance_cm" in clean:
            clean["manual_distance_cm"] = float(clean["manual_distance_cm"])
            if clean["manual_distance_cm"] <= 0:
                raise ValueError("manual_distance_cm debe ser mayor que 0.")
        if "manual_turn_deg" in clean:
            clean["manual_turn_deg"] = float(clean["manual_turn_deg"])
            if clean["manual_turn_deg"] <= 0:
                raise ValueError("manual_turn_deg debe ser mayor que 0.")
        self.config.update(clean)
        self.add_log("sistema", "Configuracion guardada.")
        return self.get_payload()

    def send_command(self, command: str, await_completion: bool = False) -> dict[str, Any]:
        command = command.strip()
        if not command:
            raise ValueError("Comando vacio.")
        if not self.state.connected:
            raise RuntimeError("Eskorpi no esta conectado. Usa modo mock o serie antes de enviar comandos.")

        blocked_reason = self._precheck_motion_block(command)
        if blocked_reason:
            self.command_result = {"status": "BLOCKED_PRECHECK", "detail": blocked_reason, "command": command}
            self.add_log("alerta", blocked_reason)
            return self.get_payload()

        with self.lock:
            self.state.last_tx = command
            self.state.updated_at = time.time()
        self.add_log("tx", command)

        if self.state.connection_mode == "serial" and self.serial_conn is not None:
            self.command_done.clear()
            self.command_result = None
            self.serial_conn.write(f"{command}\n".encode("utf-8"))
            if await_completion and not command.startswith(("STOP", "FOLLOW")):
                self._wait_for_command_completion(command)
        else:
            self._simulate_command_effect(command)
        return self.get_payload()

    def ask_ia(self, text: str, execute: bool | None = None, speak: bool | None = None) -> dict[str, Any]:
        prompt_text = text.strip()
        if not prompt_text:
            raise ValueError("Texto vacio.")

        self.add_log("usuario", prompt_text)
        state_snapshot = self.snapshot_state()
        answer = self.ia.ask(prompt_text, state_snapshot)
        self.add_log("ia", answer)

        config = self.config.get()
        if execute is None:
            execute = bool(config.get("auto_execute", True))
        if speak is None:
            speak = bool(config.get("auto_speak", True))

        speech = self.ia.speech_text(answer)
        commands = self.ia.parse_commands(answer)
        executed = []

        if speak and speech:
            self.tts.speak(speech, config.get("voz_id", "hombre_es"))

        if execute and commands:
            for cmd in commands:
                self.send_command(cmd, await_completion=self.state.connection_mode == "serial")
                executed.append(cmd)
                if self.command_result and self.command_result.get("status") == "BLOCKED_PRECHECK":
                    detail = self.command_result.get("detail", "Eskorpi no puede ejecutar ese movimiento ahora.")
                    speech = f"{speech} No puedo hacerlo: {detail}".strip()
                    break
                if self.command_result and self.command_result.get("status") != "DONE":
                    break

        return {
            **self.get_payload(),
            "assistant_text": speech,
            "raw_response": answer,
            "commands": commands,
            "executed": executed,
            "prompt_preview": self.ia.build_prompt(state_snapshot),
        }

    def _start_mock_loop(self) -> None:
        stop_event = self.mock_stop
        self.mock_thread = threading.Thread(target=self._mock_loop, args=(stop_event,), daemon=True)
        self.mock_thread.start()

    def _mock_loop(self, stop_event: threading.Event) -> None:
        swing = 0.0
        while not stop_event.is_set():
            swing += 0.4
            with self.lock:
                if self.state.connection_mode != "mock":
                    return
                self.state.distance = round(max(8.0, min(120.0, 45.0 + 15.0 * math.sin(swing))), 1)
                self.state.temperature = round(22.0 + 2.0 * math.sin(swing / 2.0), 1)
                self.state.humidity = round(55.0 + 5.0 * math.cos(swing / 2.0), 1)
                self.state.updated_at = time.time()
            if int(swing) % 14 == 0:
                self._trigger_ir("left")
            if int(swing) % 17 == 0:
                self._trigger_ir("right")
            self._decay_ir_flags()
            time.sleep(0.35)

    def _serial_loop(self) -> None:
        while True:
            with self.lock:
                conn = self.serial_conn
            if conn is None:
                return
            try:
                raw = conn.readline().decode("utf-8", errors="ignore").strip()
            except Exception as exc:
                self.add_log("error", f"Error serie: {exc}")
                self.disconnect()
                return
            if raw:
                self.add_log("rx", raw)
                if raw == "HELLO:ESKORPI":
                    self._reply_handshake()
                self._apply_sensor_line(raw)

    @staticmethod
    def _normalize_serial_port(port: str) -> str:
        upper_port = port.upper()
        if upper_port.startswith("COM"):
            suffix = upper_port[3:]
            if suffix.isdigit() and int(suffix) >= 10 and not port.startswith("\\\\.\\"):
                return f"\\\\.\\{upper_port}"
            return upper_port
        return port

    def _wait_for_serial_activity(self, timeout: float = 3.0) -> bool:
        started = time.time()
        initial_rx = self.state.last_rx
        while time.time() - started < timeout:
            time.sleep(0.1)
            with self.lock:
                conn = self.serial_conn
                current_rx = self.state.last_rx
            if conn is None:
                return False
            if current_rx and current_rx != initial_rx:
                return True
        return False

    def _reply_handshake(self) -> None:
        with self.lock:
            conn = self.serial_conn
        if conn is None:
            return
        try:
            conn.write(b"WEBUI:OK\n")
            self.add_log("tx", "WEBUI:OK")
            self.add_log("sistema", "Handshake recibido de Eskorpi. Puerto confirmado.")
        except Exception as exc:
            self.add_log("error", f"No se pudo responder al handshake: {exc}")

    def _apply_sensor_line(self, line: str) -> None:
        with self.lock:
            self.state.last_rx = line
            self.state.updated_at = time.time()
            if line.startswith("US:"):
                try:
                    self.state.distance = float(line[3:])
                except ValueError:
                    pass
            elif line.startswith("CLIMA:"):
                try:
                    temp, hum = line[6:].split(",", 1)
                    self.state.temperature = float(temp)
                    self.state.humidity = float(hum)
                except ValueError:
                    pass
            elif line == "CLIMA_ERR":
                self.add_log("alerta", "Fallo de lectura del DHT22. Revisa datos, 3.3V, GND, la resistencia y el pin configurado.")
            elif line.startswith("IR_STATUS:"):
                try:
                    left_raw, right_raw = line[10:].split(",", 1)
                    self.state.ir_left = left_raw.strip() == "1"
                    self.state.ir_right = right_raw.strip() == "1"
                except ValueError:
                    pass
            elif line == "FOLLOW:ON":
                self.state.follow_mode = True
                self.add_log("sistema", "Modo seguimiento activado.")
            elif line == "FOLLOW:OFF":
                self.state.follow_mode = False
                self.add_log("sistema", "Modo seguimiento desactivado.")
            elif line.startswith("STATUS:"):
                self.state.hardware_status = line[7:].strip().upper() or self.state.hardware_status
            elif line.startswith("DONE:"):
                action = line[5:].strip().upper()
                self.command_result = {"status": "DONE", "action": action}
                self.command_done.set()
                self.add_log("sistema", f"Movimiento completado: {action}")
            elif line.startswith("ABORTED:"):
                detail = line[8:].strip().upper()
                self.command_result = {"status": "ABORTED", "detail": detail}
                self.command_done.set()
                self.add_log("alerta", f"Movimiento abortado: {detail}")
            elif line == "LINK:OK":
                self.add_log("sistema", "Eskorpi confirmo el enlace con la WebUI.")
            elif line == "OBS_IR_IZQ":
                self._trigger_ir("left")
            elif line == "OBS_IR_DER":
                self._trigger_ir("right")
            elif line == "OBS_IR_BOTH":
                self._trigger_ir("left")
                self._trigger_ir("right")
            elif line == "OBS_ULTRA":
                self.add_log("alerta", "Obstaculo frontal detectado por ultrasonidos.")

    def _simulate_command_effect(self, command: str) -> None:
        with self.lock:
            if command.startswith("MOVE_F:"):
                self.state.distance = max(5.0, round(self.state.distance - 6.0, 1))
            elif command.startswith("MOVE_B:"):
                self.state.distance = min(140.0, round(self.state.distance + 6.0, 1))
            elif command == "STOP:0":
                self.state.hardware_status = "ON"
                self.state.follow_mode = False
            elif command == "FOLLOW:1":
                self.state.follow_mode = True
            elif command == "FOLLOW:0":
                self.state.follow_mode = False
            self.state.updated_at = time.time()

    def _precheck_motion_block(self, command: str) -> str | None:
        with self.lock:
            distance = self.state.distance
            ir_left = self.state.ir_left
            ir_right = self.state.ir_right

        if command.startswith("MOVE_F:"):
            if distance > 0 and distance < DIST_EMERGENCIA_FRENTE_CM:
                return (
                    f"No puedo avanzar: tengo un obstaculo delante a {distance:.1f} cm "
                    f"y el limite de seguridad es {DIST_EMERGENCIA_FRENTE_CM:.0f} cm."
                )

        if command.startswith("MOVE_B:"):
            if ir_left or ir_right:
                lados = []
                if ir_left:
                    lados.append("IR izquierdo")
                if ir_right:
                    lados.append("IR derecho")
                return f"No puedo retroceder: hay obstaculo detectado por {', '.join(lados)}."

        return None

    def _wait_for_command_completion(self, command: str) -> None:
        timeout = self._command_timeout(command)
        if not self.command_done.wait(timeout=timeout):
            self.add_log("alerta", f"Timeout esperando fin de comando: {command}")
            self.command_result = {"status": "TIMEOUT", "command": command}

    @staticmethod
    def _command_timeout(command: str) -> float:
        try:
            _, raw_value = command.split(":", 1)
            magnitude = abs(int(raw_value))
        except Exception:
            magnitude = 0

        if command.startswith("TURN_"):
            return max(4.0, min(20.0, 3.0 + magnitude / 400.0))
        if command.startswith("MOVE_"):
            return max(4.0, min(25.0, 3.0 + magnitude / 250.0))
        return 5.0

    def _trigger_ir(self, side: str) -> None:
        until = time.time() + 2.5
        with self.lock:
            if side == "left":
                self.state.ir_left = True
                self.ir_left_until = until
            elif side == "right":
                self.state.ir_right = True
                self.ir_right_until = until

    def _decay_ir_flags(self) -> None:
        now = time.time()
        with self.lock:
            if self.state.ir_left and now >= self.ir_left_until:
                self.state.ir_left = False
            if self.state.ir_right and now >= self.ir_right_until:
                self.state.ir_right = False


runtime = EskorpiRuntime()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self._json(runtime.get_payload())
            return
        if parsed.path == "/api/ports":
            self._json({"ports": runtime.list_ports(), "default_baud": DEFAULT_BAUD})
            return
        if parsed.path == "/health":
            self._json({"ok": True})
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        body = self._read_json_body()
        try:
            if parsed.path == "/api/connect/mock":
                self._json(runtime.connect_mock())
                return
            if parsed.path == "/api/connect/serial":
                port = (body.get("port") or "").strip()
                baudrate = int(body.get("baudrate") or DEFAULT_BAUD)
                if not port:
                    raise ValueError("Falta el puerto serie.")
                self._json(runtime.connect_serial(port, baudrate))
                return
            if parsed.path == "/api/disconnect":
                self._json(runtime.disconnect())
                return
            if parsed.path == "/api/command":
                self._json(runtime.send_command(body.get("command") or ""))
                return
            if parsed.path == "/api/config":
                self._json(runtime.save_config(body))
                return
            if parsed.path == "/api/ask":
                self._json(
                    runtime.ask_ia(
                        body.get("text") or "",
                        body.get("execute"),
                        body.get("speak"),
                    )
                )
                return
            self.send_error(HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self._json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        if not raw.strip():
            return {}
        return json.loads(raw)

    def _json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        content = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def _candidate_chrome_commands() -> list[list[str]]:
    if os.name == "nt":
        local = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", "")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", "")
        candidates = [
            [os.path.join(local, "Google", "Chrome", "Application", "chrome.exe")],
            [os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe")],
            [os.path.join(program_files_x86, "Google", "Chrome", "Application", "chrome.exe")],
            ["chrome"],
        ]
    else:
        candidates = [["google-chrome"], ["google-chrome-stable"], ["chromium"], ["chromium-browser"]]

    valid = []
    for cmd in candidates:
        exe = cmd[0]
        if os.path.isabs(exe):
            if os.path.exists(exe):
                valid.append(cmd)
        elif shutil.which(exe):
            valid.append(cmd)
    return valid


def open_chrome(url: str) -> None:
    for cmd in _candidate_chrome_commands():
        try:
            subprocess.Popen([*cmd, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Abriendo Chrome en {url}")
            return
        except Exception:
            continue
    try:
        webbrowser.open(url)
        print(f"Abriendo navegador por defecto en {url}")
    except Exception:
        print(f"No se pudo abrir el navegador automaticamente. Abre {url}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"Eskorpi WebUI en {url}")
    if AUTO_OPEN:
        threading.Timer(0.6, open_chrome, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        runtime.disconnect(silent=True)
        server.server_close()


if __name__ == "__main__":
    main()
