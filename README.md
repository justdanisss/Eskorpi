# SKORPY

Repositorio preparado para publicar la parte relevante del proyecto `Eskorpi`.

## Que incluye

- `eskorpi_arduino.ino`
  Firmware principal del robot.
- `program/`
  Programa principal para PC con WebUI.
- `App/`
  Linea movil experimental en React Native / Expo.
- `Docs/`
  Documentacion tecnica util para pinout, cableado y puesta en marcha.

## Que no incluye

- Memorias finales en `.docx`, `.odt` o `.pdf`
- Carpetas de dependencias como `node_modules`
- Configuracion local con claves reales
- Historicos y pruebas legacy no necesarios para la publicacion principal

## Arranque rapido del programa de PC

```bash
cd program
python3 main.py
```

## Dependencias Python recomendadas

```bash
pip install pyserial pyttsx3
```

## Librerias Arduino necesarias

- `DHT sensor library` by Adafruit
- `Adafruit Unified Sensor` by Adafruit

## Notas de hardware actuales

- `HC-SR04` frontal
- `DHT22 / AM2302` en `D10`
- `2 sensores IR` traseros
- `HC-05` para enlace serie Bluetooth
- `L298N` para la traccion diferencial
- Entrada principal del robot: `12V`
- Alimentacion del driver y motores: `9V`
- El `DHT22 / AM2302` esta documentado funcionando correctamente a `3.3V`

## Publicacion en GitHub

Repositorio:

`https://github.com/justdanisss/Eskorpi`

Licencia:

`MIT`

Antes de subir el proyecto:

- revisa nombres de autores y licencia
- sustituye cualquier enlace placeholder del repositorio
- comprueba que no haya claves reales ni archivos privados
- verifica que `program/pc_webui/config.json` no se suba

Se incluye un `config.example.json` limpio como referencia.
