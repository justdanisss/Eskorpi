const els = {
  pill: document.getElementById("connection-pill"),
  meta: document.getElementById("connection-meta"),
  portSelect: document.getElementById("serial-port"),
  manualPort: document.getElementById("manual-port"),
  baudInput: document.getElementById("baudrate"),
  selectedPortTarget: document.getElementById("selected-port-target"),
  distance: document.getElementById("distance"),
  distanceDuplicate: document.getElementById("distance-duplicate"),
  temperature: document.getElementById("temperature"),
  temperatureDuplicate: document.getElementById("temperature-duplicate"),
  humidity: document.getElementById("humidity"),
  humidityDuplicate: document.getElementById("humidity-duplicate"),
  irLeft: document.getElementById("ir-left"),
  irRight: document.getElementById("ir-right"),
  followMode: document.getElementById("follow-mode"),
  followModeDuplicate: document.getElementById("follow-mode-duplicate"),
  hw: document.getElementById("hw-status"),
  port: document.getElementById("port"),
  portDuplicate: document.getElementById("port-duplicate"),
  baud: document.getElementById("baud"),
  baudDuplicate: document.getElementById("baud-duplicate"),
  lastRx: document.getElementById("last-rx"),
  lastRxDuplicate: document.getElementById("last-rx-duplicate"),
  lastTx: document.getElementById("last-tx"),
  lastTxDuplicate: document.getElementById("last-tx-duplicate"),
  logs: document.getElementById("logs"),
  askText: document.getElementById("ask-text"),
  assistantText: document.getElementById("assistant-text"),
  assistantCommands: document.getElementById("assistant-commands"),
  promptPreview: document.getElementById("prompt-preview"),
  groqKey: document.getElementById("groq-key"),
  personalidad: document.getElementById("personalidad"),
  voz: document.getElementById("voz"),
  autoExecute: document.getElementById("auto-execute"),
  autoSpeak: document.getElementById("auto-speak"),
  pulsesPerMeter: document.getElementById("pulses-per-meter"),
  pulsesPerDegree: document.getElementById("pulses-per-degree"),
  manualDistanceCm: document.getElementById("manual-distance-cm"),
  manualTurnDeg: document.getElementById("manual-turn-deg"),
  portsHelp: document.getElementById("ports-help"),
  viewButtons: Array.from(document.querySelectorAll("[data-view-btn]")),
  views: Array.from(document.querySelectorAll("[data-view]")),
};

let latestPayload = null;
let recognition = null;
let configDirty = false;

function getDesiredPort() {
  const manualPort = els.manualPort.value.trim();
  const selectedPort = els.portSelect.value.trim();
  return manualPort || selectedPort;
}

function refreshDesiredPortUI() {
  const desiredPort = getDesiredPort();
  els.selectedPortTarget.textContent = desiredPort || "Ninguno";
  const connectButton = document.getElementById("connect-serial");
  connectButton.disabled = !desiredPort;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function fillSelect(select, items, value, labelKey = "label") {
  select.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item[labelKey];
    option.selected = item.id === value;
    select.appendChild(option);
  });
}

function isEditingConfig() {
  const active = document.activeElement;
  const configFields = [
    els.groqKey,
    els.personalidad,
    els.voz,
    els.autoExecute,
    els.autoSpeak,
    els.pulsesPerMeter,
    els.pulsesPerDegree,
    els.manualDistanceCm,
    els.manualTurnDeg,
  ];
  return configFields.includes(active) || configDirty;
}

function setView(viewId) {
  els.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewBtn === viewId);
  });
  els.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewId);
  });
}

function renderSensorPair(primary, secondary, value) {
  primary.textContent = value;
  if (secondary) secondary.textContent = value;
}

function renderMetaPair(primary, secondary, value) {
  primary.textContent = value;
  if (secondary) secondary.textContent = value;
}

function render(payload) {
  latestPayload = payload;
  const { state, logs, config, personalidades, voces } = payload;

  els.pill.textContent = state.connected ? `Conectado · ${state.connection_mode}` : "Sin conexion";
  els.pill.className = `pill ${state.connected ? "online" : ""}`;
  els.meta.textContent = `${state.port || "sin puerto"} · ${state.baudrate} baud`;

  renderSensorPair(els.distance, els.distanceDuplicate, `${state.distance.toFixed(1)} cm`);
  renderSensorPair(els.temperature, els.temperatureDuplicate, `${state.temperature.toFixed(1)} C`);
  renderSensorPair(els.humidity, els.humidityDuplicate, `${state.humidity.toFixed(1)} %`);
  renderSensorPair(els.irLeft, null, state.ir_left ? "ALERTA" : "OK");
  renderSensorPair(els.irRight, null, state.ir_right ? "ALERTA" : "OK");
  renderSensorPair(els.followMode, els.followModeDuplicate, state.follow_mode ? "ACTIVO" : "INACTIVO");

  els.hw.textContent = state.hardware_status;
  renderMetaPair(els.port, els.portDuplicate, state.port || "--");
  renderMetaPair(els.baud, els.baudDuplicate, String(state.baudrate));
  renderMetaPair(els.lastRx, els.lastRxDuplicate, state.last_rx || "--");
  renderMetaPair(els.lastTx, els.lastTxDuplicate, state.last_tx || "--");

  if (!isEditingConfig()) {
    fillSelect(els.personalidad, personalidades, config.personalidad_id);
    fillSelect(els.voz, voces, config.voz_id);
    els.groqKey.value = config.groq_api_key || "";
    els.autoExecute.checked = !!config.auto_execute;
    els.autoSpeak.checked = !!config.auto_speak;
    els.pulsesPerMeter.value = String(config.pulses_per_meter ?? "");
    els.pulsesPerDegree.value = String(config.pulses_per_degree ?? "");
    els.manualDistanceCm.value = String(config.manual_distance_cm ?? "");
    els.manualTurnDeg.value = String(config.manual_turn_deg ?? "");
  }

  els.logs.innerHTML = logs
    .map((entry) => `<div class="log log-${entry.type}"><span>${entry.ts}</span><strong>${entry.type}</strong><code>${entry.message}</code></div>`)
    .join("");
  els.logs.scrollTop = els.logs.scrollHeight;
}

function renderAskResult(payload) {
  render(payload);
  els.assistantText.textContent = payload.assistant_text || "Sin texto limpio.";
  els.promptPreview.textContent = payload.prompt_preview || "Sin prompt.";
  const commands = payload.commands || [];
  els.assistantCommands.innerHTML = commands.length
    ? commands.map((cmd) => `<span class="chip">${cmd}</span>`).join("")
    : '<span class="minor">Sin comandos detectados.</span>';

  if ("speechSynthesis" in window && payload.assistant_text && els.autoSpeak.checked) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(payload.assistant_text);
    utterance.lang = "es-ES";
    window.speechSynthesis.speak(utterance);
  }
}

async function refreshState() {
  render(await api("/api/state"));
}

async function refreshPorts() {
  const data = await api("/api/ports");
  els.portSelect.innerHTML = "";
  if (!data.ports.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sin puertos detectados";
    els.portSelect.appendChild(option);
    els.portsHelp.textContent =
      "No se detectaron puertos automaticamente. En Windows con Bluetooth clasico prueba a escribir manualmente COM5, COM6, etc.";
    refreshDesiredPortUI();
    return;
  }

  els.portsHelp.textContent = "Windows: COMx. Linux: /dev/rfcomm0, /dev/ttyUSB0 o similar.";

  data.ports.forEach((port) => {
    const option = document.createElement("option");
    option.value = port.device;
    option.textContent = port.description ? `${port.device} · ${port.description}` : port.device;
    els.portSelect.appendChild(option);
  });
  refreshDesiredPortUI();
}

async function saveConfig() {
  const payload = await api("/api/config", {
      method: "POST",
      body: JSON.stringify({
        groq_api_key: els.groqKey.value.trim(),
        personalidad_id: els.personalidad.value,
        voz_id: els.voz.value,
        auto_execute: els.autoExecute.checked,
        auto_speak: els.autoSpeak.checked,
        pulses_per_meter: Number(els.pulsesPerMeter.value || 0),
        pulses_per_degree: Number(els.pulsesPerDegree.value || 0),
        manual_distance_cm: Number(els.manualDistanceCm.value || 0),
        manual_turn_deg: Number(els.manualTurnDeg.value || 0),
      }),
    });
  configDirty = false;
  render(payload);
}

async function askIA(text) {
  const browserCanSpeak = "speechSynthesis" in window;
  renderAskResult(
    await api("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        text,
        execute: els.autoExecute.checked,
        speak: els.autoSpeak.checked && !browserCanSpeak,
      }),
    }),
  );
}

async function connectMock() {
  render(await api("/api/connect/mock", { method: "POST", body: "{}" }));
}

async function connectSerial() {
  const port = getDesiredPort();

  render(
    await api("/api/connect/serial", {
      method: "POST",
      body: JSON.stringify({
        port,
        baudrate: Number(els.baudInput.value || 19200),
      }),
    }),
  );
}

async function disconnect() {
  render(await api("/api/disconnect", { method: "POST", body: "{}" }));
}

async function sendCommand(command) {
  render(
    await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  );
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    document.getElementById("voice-btn").disabled = true;
    return;
  }

  recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    els.askText.value = transcript;
  };
}

document.getElementById("ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.askText.value.trim();
  if (!text) return;
  try {
    await askIA(text);
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("voice-btn").addEventListener("click", () => {
  if (recognition) recognition.start();
});

document.getElementById("save-config").addEventListener("click", () => saveConfig().catch((err) => alert(err.message)));
document.getElementById("connect-mock").addEventListener("click", () => connectMock().catch((err) => alert(err.message)));
document.getElementById("refresh-ports").addEventListener("click", () => refreshPorts().catch((err) => alert(err.message)));
document.getElementById("connect-serial").addEventListener("click", () => connectSerial().catch((err) => alert(err.message)));
document.getElementById("disconnect").addEventListener("click", () => disconnect().catch((err) => alert(err.message)));

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => sendCommand(button.dataset.command).catch((err) => alert(err.message)));
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!latestPayload) return;
    const config = latestPayload.config || {};
    const pulsesPerMeter = Number(config.pulses_per_meter || 120);
    const pulsesPerDegree = Number(config.pulses_per_degree || 11);
    const manualDistanceCm = Number(config.manual_distance_cm || 10);
    const manualTurnDeg = Number(config.manual_turn_deg || 90);

    let command = "";
    if (button.dataset.action === "forward") {
      command = `MOVE_F:${Math.round((manualDistanceCm / 100) * pulsesPerMeter)}`;
    } else if (button.dataset.action === "backward") {
      command = `MOVE_B:${Math.round((manualDistanceCm / 100) * pulsesPerMeter)}`;
    } else if (button.dataset.action === "turn_l") {
      command = `TURN_L:${Math.round(manualTurnDeg * pulsesPerDegree)}`;
    } else if (button.dataset.action === "turn_r") {
      command = `TURN_R:${Math.round(manualTurnDeg * pulsesPerDegree)}`;
    }

    if (command) {
      sendCommand(command).catch((err) => alert(err.message));
    }
  });
});

document.getElementById("command-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("custom-command");
  const command = input.value.trim();
  if (!command) return;
  sendCommand(command).catch((err) => alert(err.message));
  input.value = "";
});

[els.groqKey, els.personalidad, els.voz, els.autoExecute, els.autoSpeak, els.pulsesPerMeter, els.pulsesPerDegree, els.manualDistanceCm, els.manualTurnDeg].forEach((field) => {
  field.addEventListener("input", () => {
    configDirty = true;
  });
  field.addEventListener("change", () => {
    configDirty = true;
  });
});

els.portSelect.addEventListener("change", refreshDesiredPortUI);
els.manualPort.addEventListener("input", refreshDesiredPortUI);

els.viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewBtn));
});

setupVoice();
setView("centro");
refreshPorts().catch(console.error);
refreshState().catch(console.error);
refreshDesiredPortUI();
setInterval(() => refreshState().catch(console.error), 1500);
