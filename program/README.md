# Program

Punto de entrada consolidado de Eskorpi para PC.

## Arranque

```bash
cd program
python3 main.py
```

## Que incluye

- `main.py`: lanzador unico
- `pc_webui/`: backend + frontend local
- configuracion persistente en `pc_webui/config.json`
- firmware principal en la raiz del proyecto: `eskorpi_arduino.ino`

## Dependencias recomendadas

```bash
pip install pyserial pyttsx3
```

`pyserial` es necesaria para conexion real por puerto serie.

`pyttsx3` es opcional para voz local desde Python. Si no esta instalada, la WebUI puede seguir usando la voz del navegador.

## Hardware actual documentado

- Sensores activos:
  - `HC-SR04` frontal
  - `DHT22 / AM2302` temperatura y humedad
  - `2x IR` traseros
- Sensores retirados:
  - sensor de color
  - expansor `PCF8575`

### Notas importantes de hardware

- El `DHT22 / AM2302` actual va en `D10`
- En este montaje el sensor de clima funciona correctamente a `3.3V`
- Entrada principal del robot: `12V`
- Alimentacion del `L298N` y motores: `9V`
- Todas las masas deben ir comunes

## Notas

- Baudrate por defecto: `19200`
- La API key de Groq se puede guardar desde la propia WebUI
- Si no conectas hardware, usa `Mock`
- La guia tecnica de cableado y pinout actual esta en `Docs/ARDUINO_SETUP.md`
