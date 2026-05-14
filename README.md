# Eskorpi

Eskorpi es un robot móvil con tracción diferencial, sensores de proximidad y control asistido por inteligencia artificial. El proyecto combina firmware embebido en Arduino, una WebUI local para PC y una línea móvil experimental en React Native. La idea principal es que el robot pueda recibir órdenes naturales, traducirlas a acciones físicas y responder teniendo en cuenta su entorno inmediato.

En su estado actual, la plataforma principal de uso es el programa para PC con WebUI. Esta solución ha terminado convirtiéndose en la base operativa más estable del proyecto, ya que permite trabajar desde Windows o Linux, usar Groq como capa de IA, consultar telemetría en tiempo real y controlar el robot tanto manualmente como mediante lenguaje natural.

Repositorio oficial:

`https://github.com/justdanisss/Eskorpi`

Licencia:

`MIT`

## Características principales

- Control del robot desde una WebUI local en navegador
- Integración con IA mediante Groq
- Control manual de avance, retroceso y giro
- Telemetría en tiempo real de distancia, temperatura, humedad y sensores IR
- Modo seguimiento activable por comando
- Modo mock para seguir desarrollando sin hardware conectado
- Comunicación serie a `19200` baudios mediante `HC-05`
- Firmware con lógica de seguridad y paradas automáticas

## Arquitectura del proyecto

El repositorio se organiza en tres bloques principales:

- `eskorpi_arduino.ino`
  Firmware principal del robot. Lee sensores, controla motores, procesa comandos serie y emite telemetría.
- `program/`
  Programa principal para PC. Incluye el backend Python, la WebUI y los scripts auxiliares de conexión.
- `App/`
  Línea móvil experimental desarrollada con React Native y Expo. Sigue documentada, pero no es la plataforma principal actual.

Además, en `Docs/` se incluye documentación técnica útil para cableado, pinout y puesta en marcha.

## Hardware actual

El montaje operativo documentado actualmente utiliza:

- `Arduino BQ ZUM BT-328`
- `HC-05` para enlace serie Bluetooth
- `L298N` para control de motores
- `HC-SR04` frontal para distancia
- `DHT22 / AM2302` para temperatura y humedad
- `2 sensores IR` traseros
- `2 motores DC con encoder`

### Notas de hardware importantes

- El `DHT22 / AM2302` está conectado al pin `D10`
- En este proyecto el sensor de clima se ha validado funcionando correctamente a `3.3V`
- Entrada principal del robot: `12V`
- Alimentación del `L298N` y motores: `9V`
- Todas las masas (`GND`) deben ir comunes

### Elementos retirados en la versión actual

Ya no forman parte del montaje operativo:

- sensor de color
- expansor I2C `PCF8575`

## Estructura del software

### Firmware Arduino

El archivo [`eskorpi_arduino.ino`](./eskorpi_arduino.ino) implementa:

- inicialización de pines y periféricos
- lectura de ultrasónico, clima e IR
- control de motores y encoders
- parser de comandos serie
- handshake con la WebUI
- seguimiento de distancia
- paradas de seguridad y abortos

### Programa de PC

La carpeta [`program/`](./program) contiene la solución principal actual:

- `main.py`
  punto de entrada único
- `pc_webui/server.py`
  backend Python con estado, serie, IA, persistencia y API local
- `pc_webui/web/index.html`
  estructura de la interfaz
- `pc_webui/web/app.js`
  lógica cliente de la WebUI
- `pc_webui/web/styles.css`
  diseño visual y layout

### Línea móvil experimental

La carpeta [`App/`](./App) conserva la versión React Native / Expo desarrollada durante el proyecto. Se mantiene como referencia técnica del trabajo realizado, aunque el control principal actual del robot se realiza desde la WebUI de PC.

## Requisitos

### Para el programa de PC

- Python 3
- Navegador moderno, preferiblemente Chrome o Chromium

Dependencias Python recomendadas:

```bash
pip install pyserial pyttsx3
```

Notas:

- `pyserial` es necesaria para conexión real por puerto serie
- `pyttsx3` es opcional para voz local desde Python
- la integración con Groq usa HTTP directo, no requiere instalar la librería `groq`

### Para Arduino IDE

Para cargar el firmware necesitas estas librerías:

- `DHT sensor library` by Adafruit
- `Adafruit Unified Sensor` by Adafruit

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/justdanisss/Eskorpi.git
cd Eskorpi
```

### 2. Preparar el entorno Python

```bash
cd program
pip install -r requirements.txt
```

Si quieres voz local adicional:

```bash
pip install pyttsx3
```

### 3. Cargar el firmware en el Arduino

- abre `eskorpi_arduino.ino` en Arduino IDE
- instala las librerías de DHT indicadas arriba
- selecciona la placa correcta
- compila y sube el sketch

### 4. Revisar el cableado

Antes de probar la WebUI, verifica el pinout y la alimentación reales en:

- [`Docs/ARDUINO_SETUP.md`](./Docs/ARDUINO_SETUP.md)

## Puesta en marcha

Desde la carpeta `program`:

```bash
python3 main.py
```

Esto levantará la WebUI local, normalmente en:

`http://127.0.0.1:8765`

En muchos entornos intentará abrir el navegador automáticamente.

## Uso básico

1. Empareja o conecta el robot en tu sistema
2. Arranca la WebUI desde `program/main.py`
3. Selecciona el puerto correcto
4. Conecta a `19200`
5. Guarda la API key de Groq si vas a usar IA
6. Prueba primero en manual o en mock antes de lanzar secuencias complejas

Ejemplos comunes de puerto:

- Windows: `COM5`, `COM6`, etc.
- Linux Bluetooth clásico: `/dev/rfcomm0`
- Linux USB: `/dev/ttyUSB0`

## Protocolo serie principal

### Comandos hacia el robot

- `MOVE_F:N`
- `MOVE_B:N`
- `TURN_R:N`
- `TURN_L:N`
- `STOP:0`
- `FOLLOW:1`
- `FOLLOW:0`
- `BAILE:1`
- `WEBUI:OK`

### Telemetría desde el robot

- `HELLO:ESKORPI`
- `LINK:OK`
- `STATUS:ON`
- `US:xx.x`
- `CLIMA:tt.t,hh.h`
- `CLIMA_ERR`
- `IR_STATUS:x,y`
- `OBS_ULTRA`
- `OBS_IR_IZQ`
- `OBS_IR_DER`
- `OBS_IR_BOTH`
- `DONE:...`
- `ABORTED:...`

## Funciones destacadas

### Control manual

La WebUI permite enviar acciones manuales directas para:

- avanzar
- retroceder
- girar izquierda
- girar derecha
- parar

### Control con IA

El usuario puede escribir o dictar una instrucción natural. El backend construye un prompt contextual con sensores, personalidad y reglas operativas, consulta a Groq y traduce la respuesta a comandos ejecutables.

### Modo seguimiento

Eskorpi puede activar un modo seguimiento que intenta mantener aproximadamente una distancia de referencia usando el sensor ultrasónico. Este modo puede lanzarse manualmente o mediante la IA.

### Seguridad

El sistema incluye lógica de seguridad tanto en firmware como en backend:

- no avanzar si el ultrasónico detecta obstáculo por debajo del umbral
- no retroceder si los IR traseros están activos
- botón físico como parada del comando actual
- abortos y confirmaciones explícitas por serie

## Estado actual del proyecto

El proyecto está funcional como base de control desde PC con WebUI. La línea móvil sigue documentada, pero su integración con Bluetooth clásico en Android no se considera cerrada. Por eso, la plataforma recomendada actualmente es la solución de PC.

## Documentación técnica

Documentos útiles incluidos en este repositorio:

- [`Docs/ARDUINO_SETUP.md`](./Docs/ARDUINO_SETUP.md)
- [`Docs/README.txt`](./Docs/README.txt)
- [`program/README.md`](./program/README.md)
- [`program/pc_webui/README.md`](./program/pc_webui/README.md)

## Autores

- Daniel Peñalver García
- Sergio Cerro Morato

## Notas finales

Este repositorio recoge la base operativa del proyecto Eskorpi, pero sigue siendo un sistema vivo y experimental. Parte de su valor está precisamente en mostrar la evolución real de un robot construido, depurado y reajustado sobre hardware físico, con decisiones tomadas a partir de pruebas, fallos y mejoras continuas.
