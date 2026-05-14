/*
 * Robot Eskorpi - Código Arduino
 * Placa: BQ ZUM BT-328 Rev 2.6
 * 
 * HARDWARE:
 * - Motores N20 con encoders (L298N)
 * - 2x Sensores IR obstáculos
 * - Sensor DHT22 (AM2302)
 * - Sensor HC-SR04
 * - LED indicador
 * - Botón físico
 * 
 * Autor: [Daniel P. G.]
 * Versión: 3.0
 */

#include <DHT.h>

// ==================== CONFIGURACIÓN DE PINES ====================

// L298N Motor Driver
#define MOTOR_ENA   6   // PWM ENA del driver
#define MOTOR_ENB   5   // PWM ENB del driver
#define MOTOR_IN1   A0  // IN1 del driver
#define MOTOR_IN2   A2  // IN2 del driver
#define MOTOR_IN3   A1  // IN3 del driver
#define MOTOR_IN4   A3

// Encoders Motores
#define ENC_DER_C1  2   // Motor derecho - Interrupción INT0
#define ENC_DER_C2  4
#define ENC_IZQ_C1  3   // Motor izquierdo - Interrupción INT1
#define ENC_IZQ_C2  7

// DHT22 Temperatura/Humedad
// D13 puede dar lecturas poco fiables en placas tipo Arduino por el LED integrado.
// Usamos D10, que ha quedado libre tras retirar el sensor de color.
#define DHT_PIN     10
#define DHT_TYPE    DHT22

// Sensores y auxiliares directos
#define LED_PIN      8
#define BOTON_PIN    9
#define IR1_PIN      11
#define IR2_PIN      12
#define US_TRIG_PIN  A4
#define US_ECHO_PIN  A5

// ==================== CONSTANTES ====================

// Motores
#define VELOCIDAD_BASE    180   // PWM 0-255
#define VELOCIDAD_GIRO    150   // PWM para giros
#define TOLERANCIA_PULSOS 5     // Margen de error en pulsos

// Sensores
#define DIST_OBSTACULO    15    // cm - distancia obstáculo frontal
#define DIST_EMERGENCIA_FRENTE 10.0
#define INTERVALO_CLIMA   2000  // ms - cada cuánto leer DHT22
#define INTERVALO_US      100   // ms - cada cuánto leer ultrasonidos
#define INTERVALO_IR_STATUS 250 // ms - refresco continuo del estado IR
#define INTERVALO_HANDSHAKE 2000 // ms - anuncio hasta que la WebUI confirme enlace
#define DIST_SEGUIMIENTO_OBJETIVO 10.0
#define DIST_SEGUIMIENTO_BANDA 2.0
#define DIST_SEGUIMIENTO_MAX 80.0
#define PULSOS_SEGUIMIENTO 8
#define INTERVALO_SEGUIMIENTO 250

// Estados hardware
enum EstadoHW {
  HW_ON,
  HW_SLEEP,
  HW_PAIRING
};

enum MotionResult {
  MOTION_CONTINUE,
  MOTION_DONE,
  MOTION_STOP_REMOTE,
  MOTION_STOP_BUTTON,
  MOTION_BLOCKED_FRONT,
  MOTION_BLOCKED_REAR
};

// ==================== VARIABLES GLOBALES ====================

// Encoders (volatile porque se usan en interrupciones)
volatile long pulsos_der = 0;
volatile long pulsos_izq = 0;

// Estado
EstadoHW estado_actual = HW_ON;
unsigned long ultima_lectura_clima = 0;
unsigned long ultima_lectura_us = 0;
unsigned long ultima_publicacion_ir = 0;
bool boton_presionado_anterior = false;
bool stop_requested = false;
bool stop_from_button = false;
bool webui_confirmada = false;
bool modo_seguimiento = false;
unsigned long ultimo_handshake = 0;
unsigned long ultima_accion_seguimiento = 0;

// Objetos
DHT dht(DHT_PIN, DHT_TYPE);

void motor_derecho_adelante();
void motor_derecho_atras();
void motor_izquierdo_adelante();
void motor_izquierdo_atras();
float medir_distancia_frontal();
bool obstaculo_trasero_activo();
MotionResult revisar_movimiento(bool vigilar_frente, bool vigilar_detras);
void informar_resultado(const char* accion, MotionResult result);
void set_modo_seguimiento(bool activo);
void actualizar_modo_seguimiento();
bool leer_clima_sensor(float &temp, float &hum);

// ==================== SETUP ====================

void setup() {
  Serial.begin(19200);
  Serial.setTimeout(25);
  
  // Inicializar sensor de clima
  dht.begin();
  delay(1500);
  
  // Configurar pines motores
  pinMode(MOTOR_ENA, OUTPUT);
  pinMode(MOTOR_ENB, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  
  // Configurar encoders con interrupciones
  pinMode(ENC_DER_C1, INPUT_PULLUP);
  pinMode(ENC_DER_C2, INPUT_PULLUP);
  pinMode(ENC_IZQ_C1, INPUT_PULLUP);
  pinMode(ENC_IZQ_C2, INPUT_PULLUP);
  
  attachInterrupt(digitalPinToInterrupt(ENC_DER_C1), encoder_der_ISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_IZQ_C1), encoder_izq_ISR, CHANGE);
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BOTON_PIN, INPUT_PULLUP);
  pinMode(IR1_PIN, INPUT_PULLUP);
  pinMode(IR2_PIN, INPUT_PULLUP);
  pinMode(US_TRIG_PIN, OUTPUT);
  pinMode(US_ECHO_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(US_TRIG_PIN, LOW);
  
  // Detener motores al inicio
  detener_motores();
  
  Serial.println("STATUS:ON");
  delay(100);
}

// ==================== LOOP PRINCIPAL ====================

void loop() {
  // Leer comandos del Serial
  if (Serial.available() > 0) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();
    procesar_comando(comando);
  }

  if (!webui_confirmada && millis() - ultimo_handshake >= INTERVALO_HANDSHAKE) {
    Serial.println("HELLO:ESKORPI");
    ultimo_handshake = millis();
  }
  
  // Leer botón físico
  leer_boton();
  
  // Si está en SLEEP, no hacer lecturas de sensores
  if (estado_actual == HW_SLEEP) {
    delay(100);
    return;
  }
  
  // Lecturas periódicas de sensores
  unsigned long ahora = millis();
  
  // Clima cada 5 segundos
  if (ahora - ultima_lectura_clima >= INTERVALO_CLIMA) {
    leer_clima();
    ultima_lectura_clima = ahora;
  }
  
  // Ultrasonidos cada 100ms
  if (ahora - ultima_lectura_us >= INTERVALO_US) {
    leer_ultrasonidos();
    ultima_lectura_us = ahora;
  }
  
  // Leer sensores IR
  leer_sensores_ir();

  actualizar_modo_seguimiento();
  
  delay(10);
}

// ==================== PROCESAMIENTO DE COMANDOS ====================

void procesar_comando(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  stop_requested = false;

  // Formato esperado: "COMANDO:VALOR"
  int separador = cmd.indexOf(':');
  if (separador == -1) return;
  
  String accion = cmd.substring(0, separador);
  String valor_str = cmd.substring(separador + 1);
  long valor = valor_str.toInt();
  
  accion.toUpperCase();

  if (accion == "WEBUI" && valor_str == "OK") {
    webui_confirmada = true;
    Serial.println("LINK:OK");
    return;
  }

  stop_requested = false;
  stop_from_button = false;
  
  if (accion == "MOVE_F") {
    set_modo_seguimiento(false);
    informar_resultado("MOVE_F", mover_adelante(valor));
  }
  else if (accion == "MOVE_B") {
    set_modo_seguimiento(false);
    informar_resultado("MOVE_B", mover_atras(valor));
  }
  else if (accion == "TURN_R") {
    set_modo_seguimiento(false);
    informar_resultado("TURN_R", girar_derecha(valor));
  }
  else if (accion == "TURN_L") {
    set_modo_seguimiento(false);
    informar_resultado("TURN_L", girar_izquierda(valor));
  }
  else if (accion == "FOLLOW") {
    set_modo_seguimiento(valor > 0);
  }
  else if (accion == "STOP") {
    stop_requested = true;
    set_modo_seguimiento(false);
    detener_motores();
  }
  else if (accion == "BAILE") {
    set_modo_seguimiento(false);
    informar_resultado("BAILE", baile_robot());
  }
}

// ==================== CONTROL DE MOTORES ====================

MotionResult mover_adelante(long pulsos_objetivo) {
  float distancia_inicial = medir_distancia_frontal();
  if (distancia_inicial > 0 && distancia_inicial < DIST_EMERGENCIA_FRENTE) {
    detener_motores();
    return MOTION_BLOCKED_FRONT;
  }

  pulsos_der = 0;
  pulsos_izq = 0;
  
  // En el montaje actual, para avanzar ambos motores deben ir en el
  // sentido contrario al que usamos en los giros.
  motor_derecho_atras();
  motor_izquierdo_atras();
  
  analogWrite(MOTOR_ENA, VELOCIDAD_BASE);
  analogWrite(MOTOR_ENB, VELOCIDAD_BASE);
  
  // Esperar a alcanzar pulsos
  while (abs(pulsos_der) < pulsos_objetivo || abs(pulsos_izq) < pulsos_objetivo) {
    MotionResult estado = revisar_movimiento(true, false);
    if (estado != MOTION_CONTINUE) {
      return estado;
    }

    // Compensación: si un motor va más lento, ajustar PWM
    if (abs(pulsos_der) < abs(pulsos_izq) - 10) {
      analogWrite(MOTOR_ENA, VELOCIDAD_BASE + 20);
      analogWrite(MOTOR_ENB, VELOCIDAD_BASE - 10);
    }
    else if (abs(pulsos_izq) < abs(pulsos_der) - 10) {
      analogWrite(MOTOR_ENA, VELOCIDAD_BASE - 10);
      analogWrite(MOTOR_ENB, VELOCIDAD_BASE + 20);
    }
    delay(10);
  }
  
  detener_motores();
  return MOTION_DONE;
}

MotionResult mover_atras(long pulsos_objetivo) {
  if (obstaculo_trasero_activo()) {
    detener_motores();
    return MOTION_BLOCKED_REAR;
  }

  pulsos_der = 0;
  pulsos_izq = 0;
  
  motor_derecho_adelante();
  motor_izquierdo_adelante();
  
  analogWrite(MOTOR_ENA, VELOCIDAD_BASE);
  analogWrite(MOTOR_ENB, VELOCIDAD_BASE);
  
  while (abs(pulsos_der) < pulsos_objetivo || abs(pulsos_izq) < pulsos_objetivo) {
    MotionResult estado = revisar_movimiento(false, true);
    if (estado != MOTION_CONTINUE) {
      return estado;
    }
    delay(10);
  }
  
  detener_motores();
  return MOTION_DONE;
}

MotionResult girar_derecha(long pulsos_objetivo) {
  pulsos_der = 0;
  pulsos_izq = 0;
  
  motor_derecho_atras();
  motor_izquierdo_adelante();
  
  analogWrite(MOTOR_ENA, VELOCIDAD_GIRO);
  analogWrite(MOTOR_ENB, VELOCIDAD_GIRO);
  
  while (abs(pulsos_der) < pulsos_objetivo || abs(pulsos_izq) < pulsos_objetivo) {
    MotionResult estado = revisar_movimiento(false, false);
    if (estado != MOTION_CONTINUE) {
      return estado;
    }
    delay(10);
  }
  
  detener_motores();
  return MOTION_DONE;
}

MotionResult girar_izquierda(long pulsos_objetivo) {
  pulsos_der = 0;
  pulsos_izq = 0;
  
  motor_derecho_adelante();
  motor_izquierdo_atras();
  
  analogWrite(MOTOR_ENA, VELOCIDAD_GIRO);
  analogWrite(MOTOR_ENB, VELOCIDAD_GIRO);
  
  while (abs(pulsos_der) < pulsos_objetivo || abs(pulsos_izq) < pulsos_objetivo) {
    MotionResult estado = revisar_movimiento(false, false);
    if (estado != MOTION_CONTINUE) {
      return estado;
    }
    delay(10);
  }
  
  detener_motores();
  return MOTION_DONE;
}

void detener_motores() {
  analogWrite(MOTOR_ENA, 0);
  analogWrite(MOTOR_ENB, 0);
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
}

void motor_derecho_adelante() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
}

void motor_derecho_atras() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);
}

void motor_izquierdo_adelante() {
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);
}

void motor_izquierdo_atras() {
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
}

bool atender_stop_durante_movimiento() {
  if (Serial.available() <= 0) return false;

  String comando = Serial.readStringUntil('\n');
  comando.trim();
  comando.toUpperCase();

  if (comando == "STOP:0" || comando == "STOP") {
    stop_requested = true;
    stop_from_button = false;
    detener_motores();
    return true;
  }

  return false;
}

MotionResult revisar_movimiento(bool vigilar_frente, bool vigilar_detras) {
  if (atender_stop_durante_movimiento()) {
    return MOTION_STOP_REMOTE;
  }

  leer_boton();
  if (stop_requested && stop_from_button) {
    detener_motores();
    return MOTION_STOP_BUTTON;
  }

  if (vigilar_frente) {
    float distancia = medir_distancia_frontal();
    if (distancia > 0 && distancia < DIST_EMERGENCIA_FRENTE) {
      detener_motores();
      return MOTION_BLOCKED_FRONT;
    }
  }

  if (vigilar_detras && obstaculo_trasero_activo()) {
    detener_motores();
    return MOTION_BLOCKED_REAR;
  }

  return MOTION_CONTINUE;
}

MotionResult baile_robot() {
  MotionResult result = girar_izquierda(200);
  if (result != MOTION_DONE) return result;
  result = girar_derecha(400);
  if (result != MOTION_DONE) return result;
  result = girar_izquierda(200);
  if (result != MOTION_DONE) return result;
  result = mover_atras(100);
  if (result != MOTION_DONE) return result;
  return mover_adelante(100);
}

void set_modo_seguimiento(bool activo) {
  bool cambio = modo_seguimiento != activo;
  modo_seguimiento = activo;
  detener_motores();
  ultima_accion_seguimiento = 0;
  stop_requested = false;
  stop_from_button = false;

  if (activo) {
    digitalWrite(LED_PIN, HIGH);
  } else if (digitalRead(BOTON_PIN) == HIGH) {
    digitalWrite(LED_PIN, LOW);
  }

  if (cambio || activo) {
    Serial.println(activo ? "FOLLOW:ON" : "FOLLOW:OFF");
  }
}

void actualizar_modo_seguimiento() {
  if (!modo_seguimiento || estado_actual == HW_SLEEP) return;

  if (millis() - ultima_accion_seguimiento < INTERVALO_SEGUIMIENTO) {
    return;
  }
  ultima_accion_seguimiento = millis();

  if (stop_requested || stop_from_button) {
    set_modo_seguimiento(false);
    return;
  }

  float distancia = medir_distancia_frontal();
  if (distancia < 0) {
    detener_motores();
    return;
  }

  if (distancia > DIST_SEGUIMIENTO_MAX) {
    detener_motores();
    return;
  }

  if (distancia > DIST_SEGUIMIENTO_OBJETIVO + DIST_SEGUIMIENTO_BANDA) {
    MotionResult result = mover_adelante(PULSOS_SEGUIMIENTO);
    if (result == MOTION_STOP_REMOTE || result == MOTION_STOP_BUTTON) {
      set_modo_seguimiento(false);
    }
    return;
  }

  if (distancia < DIST_SEGUIMIENTO_OBJETIVO - DIST_SEGUIMIENTO_BANDA) {
    MotionResult result = mover_atras(PULSOS_SEGUIMIENTO);
    if (result == MOTION_STOP_REMOTE || result == MOTION_STOP_BUTTON) {
      set_modo_seguimiento(false);
    }
    return;
  }

  detener_motores();
}

// ==================== INTERRUPCIONES ENCODERS ====================

void encoder_der_ISR() {
  // Leer estado de ambos canales
  bool c1 = digitalRead(ENC_DER_C1);
  bool c2 = digitalRead(ENC_DER_C2);
  
  // Incrementar o decrementar según dirección
  if (c1 == c2) {
    pulsos_der++;
  } else {
    pulsos_der--;
  }
}

void encoder_izq_ISR() {
  bool c1 = digitalRead(ENC_IZQ_C1);
  bool c2 = digitalRead(ENC_IZQ_C2);
  
  if (c1 == c2) {
    pulsos_izq++;
  } else {
    pulsos_izq--;
  }
}

// ==================== LECTURA DE SENSORES ====================

void leer_clima() {
  float temp = 0.0;
  float hum = 0.0;

  if (!leer_clima_sensor(temp, hum)) {
    Serial.println("CLIMA_ERR");
    return;
  }
  
  // Enviar datos
  Serial.print("CLIMA:");
  Serial.print(temp, 1);  // 1 decimal
  Serial.print(",");
  Serial.println(hum, 1);
  
  // Alerta de calor
  if (temp > 35.0) {
    Serial.print("TEMP:");
    Serial.println(temp, 1);
  }
}

bool leer_clima_sensor(float &temp, float &hum) {
  temp = dht.readTemperature();
  hum = dht.readHumidity();
  return !(isnan(temp) || isnan(hum));
}

void leer_ultrasonidos() {
  float distancia = medir_distancia_frontal();
  if (distancia < 0) return;

  if (distancia >= 0.5 && distancia <= 400) {
    Serial.print("US:");
    Serial.println(distancia, 1);
    
    if (distancia < DIST_OBSTACULO) {
      Serial.println("OBS_ULTRA");
    }
  }
}

float medir_distancia_frontal() {
  // Enviar pulso trigger (10µs)
  digitalWrite(US_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(US_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(US_TRIG_PIN, LOW);
  
  // Leer echo (timeout 30ms = ~500cm)
  long duracion = pulseIn(US_ECHO_PIN, HIGH, 30000);
  
  if (duracion == 0) {
    return -1.0;  // Timeout, sin objeto detectado
  }
  
  // Calcular distancia (velocidad sonido: 343 m/s)
  float distancia = (duracion * 0.0343) / 2.0;
  return distancia;
}

void leer_sensores_ir() {
  bool ir1 = digitalRead(IR1_PIN);  // LOW = obstáculo detectado
  bool ir2 = digitalRead(IR2_PIN);
  
  static bool ir1_anterior = HIGH;
  static bool ir2_anterior = HIGH;
  
  // Detectar cambios (evitar spam)
  if (!ir1 && ir1_anterior) {
    Serial.println("OBS_IR_IZQ");
  }
  if (!ir2 && ir2_anterior) {
    Serial.println("OBS_IR_DER");
  }
  if (!ir1 && !ir2 && (ir1_anterior || ir2_anterior)) {
    Serial.println("OBS_IR_BOTH");
  }

  if (millis() - ultima_publicacion_ir >= INTERVALO_IR_STATUS || ir1 != ir1_anterior || ir2 != ir2_anterior) {
    Serial.print("IR_STATUS:");
    Serial.print(ir1 == LOW ? 1 : 0);
    Serial.print(",");
    Serial.println(ir2 == LOW ? 1 : 0);
    ultima_publicacion_ir = millis();
  }
  
  ir1_anterior = ir1;
  ir2_anterior = ir2;
}

bool obstaculo_trasero_activo() {
  return digitalRead(IR1_PIN) == LOW || digitalRead(IR2_PIN) == LOW;
}

void leer_boton() {
  bool boton = digitalRead(BOTON_PIN);  // LOW = presionado
  
  // Detectar flanco descendente (presión)
  if (!boton && boton_presionado_anterior) {
    stop_requested = true;
    stop_from_button = true;
    detener_motores();
    digitalWrite(LED_PIN, HIGH);
    delay(50);  // Debounce
  }
  
  if (boton) {
    digitalWrite(LED_PIN, LOW);
  }

  boton_presionado_anterior = boton;
}

void informar_resultado(const char* accion, MotionResult result) {
  switch (result) {
    case MOTION_DONE:
      Serial.print("DONE:");
      Serial.println(accion);
      break;
    case MOTION_STOP_REMOTE:
      Serial.print("ABORTED:");
      Serial.print(accion);
      Serial.println(":REMOTE_STOP");
      break;
    case MOTION_STOP_BUTTON:
      Serial.print("ABORTED:");
      Serial.print(accion);
      Serial.println(":BUTTON_STOP");
      break;
    case MOTION_BLOCKED_FRONT:
      Serial.print("ABORTED:");
      Serial.print(accion);
      Serial.println(":FRONT_BLOCK");
      break;
    case MOTION_BLOCKED_REAR:
      Serial.print("ABORTED:");
      Serial.print(accion);
      Serial.println(":REAR_BLOCK");
      break;
    default:
      break;
  }
}

// ==================== FIN DEL CÓDIGO ====================
