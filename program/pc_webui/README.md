# Eskorpi WebUI

Version de PC/WebUI de Eskorpi con arranque unico desde `program/main.py`.

## Que hace ahora

- Levanta una WebUI local en `http://127.0.0.1:8765`
- Intenta abrir Chrome automaticamente al arrancar
- Tiene modo mock para trabajar sin el robot conectado
- Soporta conexion serie real si `pyserial` esta instalado
- Usa `19200` como baudrate por defecto
- Guarda configuracion local de API key, personalidad, voz y automatismos
- Consulta a Groq con prompt construido desde sensores y personalidad
- Extrae comandos tipo `[forward: X]`, `[turn_r: X]`, `[MODE: STOP]` y `[baile: 1]`
- Ejecuta comandos contra el robot o contra el mock
- Tiene dictado por navegador en Chrome si la API de voz esta disponible

## Hardware real soportado ahora mismo

La WebUI actual esta alineada con el hardware real de Eskorpi en su estado actual:

- `HC-SR04` frontal
- `DHT22 / AM2302` para temperatura y humedad
- `2 sensores IR` traseros
- `HC-05` para enlace serie Bluetooth
- `L298N` para traccion diferencial

Ya no forma parte del montaje operativo actual:

- sensor de color
- expansor `PCF8575`

## Arranque recomendado

Desde la carpeta `program`:

```bash
python3 main.py
```

Tambien puedes lanzar solo la WebUI asi:

```bash
cd pc_webui
python3 server.py
```

## Dependencias utiles

Minimas:

```bash
pip install pyserial
```

Opcionales:

```bash
pip install pyttsx3
```

Notas:

- La llamada a Groq no necesita libreria `groq`, usa HTTP directo.
- La voz del navegador depende de Chrome o Chromium.
- La API key se puede guardar desde la propia WebUI.
- El sensor `DHT22 / AM2302` esta documentado en este proyecto funcionando a `3.3V`.

## Conexion real

1. Empareja o conecta el robot en tu sistema
2. Abre `program/main.py`
3. Elige el puerto correcto en la WebUI
4. Conecta a `19200`

Ejemplos comunes:

- Windows: `COM5`
- Linux Bluetooth clasico: `/dev/rfcomm0`
- Linux USB: `/dev/ttyUSB0`

## Telemetria que deberias ver

En conexion real, la WebUI esta preparada para recibir:

- `STATUS:ON`
- `US:xx.x`
- `CLIMA:tt.t,hh.h`
- `CLIMA_ERR`
- `IR_STATUS:x,y`
- `OBS_ULTRA`
- `OBS_IR_IZQ`
- `OBS_IR_DER`
- `OBS_IR_BOTH`
- `HELLO:ESKORPI`
- `LINK:OK`

## Referencia de documentacion tecnica

Para pinout, cableado y notas electricas del montaje actual:

- `Docs/ARDUINO_SETUP.md`

## Variables de entorno utiles

```bash
ESKORPI_HOST=127.0.0.1
ESKORPI_PORT=8765
ESKORPI_BAUD=19200
ESKORPI_OPEN_BROWSER=1
GROQ_API_KEY=tu_clave
```
