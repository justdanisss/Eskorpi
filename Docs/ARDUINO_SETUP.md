# Eskorpi Arduino - Documentacion tecnica actual

Esta guia describe el hardware y el firmware reales del montaje actual de Eskorpi.

## Estado actual del hardware

El robot ya no usa:

- sensor de color
- expansor I2C `PCF8575`

El montaje actual se basa en conexiones directas al Arduino BQ ZUM BT-328.

## Librerias necesarias en Arduino IDE

Para cargar `eskorpi_arduino.ino` necesitas instalar estas librerias:

- `DHT sensor library` by Adafruit
- `Adafruit Unified Sensor` by Adafruit

El sensor de clima actual es un `DHT22 / AM2302` y en este proyecto se ha comprobado que funciona correctamente alimentado a `3.3V`.

## Pinout real del firmware actual

### Pines digitales

| Pin | Senal | Elemento |
| --- | --- | --- |
| `D2` | `ENC_DER_C1` | Encoder motor derecho canal A |
| `D3` | `ENC_IZQ_C1` | Encoder motor izquierdo canal A |
| `D4` | `ENC_DER_C2` | Encoder motor derecho canal B |
| `D5` | `MOTOR_ENB` | PWM motor izquierdo en L298N |
| `D6` | `MOTOR_ENA` | PWM motor derecho en L298N |
| `D7` | `ENC_IZQ_C2` | Encoder motor izquierdo canal B |
| `D8` | `LED_PIN` | LED de estado |
| `D9` | `BOTON_PIN` | Boton fisico |
| `D10` | `DHT_PIN` | Datos del DHT22 / AM2302 |
| `D11` | `IR1_PIN` | Sensor IR trasero izquierdo |
| `D12` | `IR2_PIN` | Sensor IR trasero derecho |

### Pines analogicos usados como digitales

| Pin | Senal | Elemento |
| --- | --- | --- |
| `A0` | `MOTOR_IN1` | Direccion motor derecho |
| `A1` | `MOTOR_IN3` | Direccion motor izquierdo |
| `A2` | `MOTOR_IN2` | Direccion motor derecho |
| `A3` | `MOTOR_IN4` | Direccion motor izquierdo |
| `A4` | `US_TRIG_PIN` | Trigger HC-SR04 |
| `A5` | `US_ECHO_PIN` | Echo HC-SR04 |

## Sensores activos del sistema

Actualmente Eskorpi usa estos sensores:

- `HC-SR04` para distancia frontal
- `DHT22 / AM2302` para temperatura y humedad
- `2 sensores IR` para obstaculos traseros

## Alimentacion recomendada

En el montaje actual la documentacion debe reflejar esto:

- entrada principal del robot: `12V`
- alimentacion del driver de motores `L298N`: `9V`
- logica y sensores: tension regulada adecuada segun modulo
- `DHT22 / AM2302`: alimentado a `3.3V`

Muy importante:

- todas las masas (`GND`) deben estar unidas
- no alimentes los motores desde el USB del Arduino

## Resumen de cableado principal

### Driver L298N

| Origen | Destino |
| --- | --- |
| `D6` | `ENA` |
| `D5` | `ENB` |
| `A0` | `IN1` |
| `A2` | `IN2` |
| `A1` | `IN3` |
| `A3` | `IN4` |

### Encoders

| Origen | Destino |
| --- | --- |
| Encoder derecho A | `D2` |
| Encoder derecho B | `D4` |
| Encoder izquierdo A | `D3` |
| Encoder izquierdo B | `D7` |

### Sensor de clima

| Origen | Destino |
| --- | --- |
| `AM2302 / DHT22 DATA` | `D10` |
| `AM2302 / DHT22 VCC` | `3.3V` |
| `AM2302 / DHT22 GND` | `GND` |

### Ultrasonidos

| Origen | Destino |
| --- | --- |
| `TRIG` | `A4` |
| `ECHO` | `A5` |
| `VCC` | Alimentacion del modulo |
| `GND` | `GND` |

### IR traseros

| Origen | Destino |
| --- | --- |
| `IR izquierdo OUT` | `D11` |
| `IR derecho OUT` | `D12` |
| `VCC` | Alimentacion del modulo |
| `GND` | `GND` |

### Elementos auxiliares

| Origen | Destino |
| --- | --- |
| Boton | `D9` |
| LED | `D8` |

## Protocolo serie actual

### Comandos PC/WebUI -> Arduino

Formato:

```text
CMD:VALOR
```

Ejemplos:

- `MOVE_F:120`
- `MOVE_B:120`
- `TURN_R:990`
- `TURN_L:990`
- `STOP:0`
- `FOLLOW:1`
- `FOLLOW:0`
- `BAILE:1`
- `WEBUI:OK`

### Telemetria Arduino -> PC/WebUI

Ejemplos:

- `HELLO:ESKORPI`
- `LINK:OK`
- `STATUS:ON`
- `US:23.4`
- `CLIMA:24.1,52.0`
- `CLIMA_ERR`
- `IR_STATUS:0,1`
- `OBS_ULTRA`
- `OBS_IR_IZQ`
- `OBS_IR_DER`
- `OBS_IR_BOTH`
- `DONE:MOVE_F`
- `ABORTED:MOVE_F:FRONT_BLOCK`

## Comportamientos de seguridad del firmware

- si el ultrasonidos detecta un obstaculo frontal por debajo del umbral de seguridad, no deja avanzar
- si los IR traseros detectan obstaculo, no deja retroceder
- si el boton fisico se pulsa durante un movimiento, actua como parada del comando actual
- el modo seguimiento puede activarse con `FOLLOW:1` y desactivarse con `FOLLOW:0`

## Comprobaciones rapidas recomendadas

### 1. Verificar clima

Abre monitor serie a `19200` y comprueba que aparezcan lineas como:

```text
CLIMA:23.8,51.2
```

Si aparece:

```text
CLIMA_ERR
```

revisa:

- librerias instaladas
- `D10`
- `3.3V`
- `GND`
- resistencia y cableado del sensor

### 2. Verificar ultrasonidos

Comprueba que salgan lineas:

```text
US:45.3
```

### 3. Verificar IR

Comprueba que salgan lineas:

```text
IR_STATUS:0,0
IR_STATUS:1,0
IR_STATUS:1,1
```

### 4. Verificar handshake con la WebUI

Al arrancar, si aun no hay enlace, el robot enviara:

```text
HELLO:ESKORPI
```

Y la WebUI respondera:

```text
WEBUI:OK
```

Tras ello deberia verse:

```text
LINK:OK
```
