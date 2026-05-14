ESKORPI - RESUMEN TECNICO ACTUAL

1. Plataforma principal

La plataforma principal operativa de Eskorpi es el programa de PC con WebUI.
La app movil sigue documentada como linea experimental, pero no es la via
principal de uso.

2. Sensores activos

- HC-SR04 frontal
- DHT22 / AM2302 temperatura y humedad
- 2 sensores IR traseros

3. Sensores retirados

- Sensor de color
- Expansor I2C PCF8575

4. Pinout actual relevante

- D8  -> LED
- D9  -> Boton
- D10 -> DHT22 / AM2302 DATA
- D11 -> IR izquierdo OUT
- D12 -> IR derecho OUT
- A4  -> Trigger HC-SR04
- A5  -> Echo HC-SR04

Motores / driver:

- D6 -> ENA
- D5 -> ENB
- A0 -> IN1
- A2 -> IN2
- A1 -> IN3
- A3 -> IN4

Encoders:

- D2 -> Encoder derecho A
- D4 -> Encoder derecho B
- D3 -> Encoder izquierdo A
- D7 -> Encoder izquierdo B

5. Alimentacion documentada

- Entrada principal del robot: 12V
- Driver L298N / motores: 9V
- Sensor DHT22 / AM2302: 3.3V
- GND comun en todo el sistema

6. Librerias Arduino necesarias

- DHT sensor library
- Adafruit Unified Sensor

7. Baudrate correcto

- 19200

8. Protocolo actual visible

Telemetria:

- STATUS:ON
- US:xx.x
- CLIMA:tt.t,hh.h
- CLIMA_ERR
- IR_STATUS:x,y
- OBS_ULTRA
- OBS_IR_IZQ
- OBS_IR_DER
- OBS_IR_BOTH
- HELLO:ESKORPI
- LINK:OK

Comandos:

- MOVE_F:n
- MOVE_B:n
- TURN_R:n
- TURN_L:n
- STOP:0
- FOLLOW:1
- FOLLOW:0
- BAILE:1
