// ─── Calibración motores ─────────────────────────────────────
const PULSOS_POR_METRO = 700 / (Math.PI * 0.043);   // ~5186
const PULSOS_POR_GRADO = 8.5;

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE  = 'https://api.groq.com/openai/v1';

/** Transcribe audio con Whisper (Groq) */
export async function transcribirAudio(uri, groqKey) {
  if (!groqKey) throw new Error('Falta la API key de Groq. Añádela en Ajustes.');
  const form = new FormData();
  form.append('file', { uri, name: 'rec.m4a', type: 'audio/m4a' });
  form.append('model', 'whisper-large-v3');
  form.append('language', 'es');
  form.append('response_format', 'json');

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.text?.trim() ?? '';
}

/**
 * Consulta al LLM.
 * @param {string} textoUsuario
 * @param {string} systemPrompt  - Ya construido con contexto de sensores (via buildPrompt)
 * @param {string} groqKey
 */
export async function consultarIA(textoUsuario, systemPrompt, groqKey) {
  if (!groqKey) throw new Error('Falta la API key de Groq. Añádela en Ajustes.');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: textoUsuario },
      ],
      temperature: 0.75,
      max_tokens: 130,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response';
}

/** Extrae comandos BT del texto de la IA */
export function parsearComandos(texto) {
  const cmds = [];
  const matches = [...texto.matchAll(/\[(\w+):\s*([\d.]+)m?\]/gi)];

  for (const [, accion, valor] of matches) {
    const v = parseFloat(valor);
    switch (accion.toUpperCase()) {
      case 'FORWARD':  cmds.push(`MOVE_F:${Math.round(v * PULSOS_POR_METRO)}`); break;
      case 'BACKWARD': cmds.push(`MOVE_B:${Math.round(v * PULSOS_POR_METRO)}`); break;
      case 'TURN_R':   cmds.push(`TURN_R:${Math.round(v * PULSOS_POR_GRADO)}`); break;
      case 'TURN_L':   cmds.push(`TURN_L:${Math.round(v * PULSOS_POR_GRADO)}`); break;
    }
  }

  if (/\[baile/i.test(texto)) {
    cmds.push('TURN_L:200','TURN_R:400','TURN_L:200','MOVE_B:100','MOVE_F:100');
  }
  return cmds;
}

/** Quita los tokens de comando del texto para vocalizar */
export function soloTexto(respuesta) {
  return respuesta.replace(/\[.*?\]/g, '').trim();
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/** Ejecuta lista de comandos con delay entre ellos */
export async function ejecutarComandos(cmds, enviarFn) {
  for (const cmd of cmds) {
    await enviarFn(cmd);
    await delay(900);
  }
}
