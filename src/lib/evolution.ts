// Cliente mínimo da Evolution API v2
function cfg() {
  const url = process.env.EVOLUTION_URL?.replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE ?? "achadinhos";
  if (!url || !key) throw new Error("EVOLUTION_URL / EVOLUTION_API_KEY não configurados");
  return { url, key, instance };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { url, key } = cfg();
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export type EvoGroup = { id: string; subject: string; size?: number };

export async function fetchGroups(): Promise<EvoGroup[]> {
  const { instance } = cfg();
  return call<EvoGroup[]>("GET", `/group/fetchAllGroups/${instance}?getParticipants=false`);
}

export async function sendText(jid: string, text: string) {
  const { instance } = cfg();
  return call("POST", `/message/sendText/${instance}`, { number: jid, text });
}

/** Envia imagem com legenda. `media` pode ser uma URL ou o JPEG em base64 (sem prefixo data:) */
export async function sendImage(jid: string, media: string, caption: string) {
  const { instance } = cfg();
  return call("POST", `/message/sendMedia/${instance}`, {
    number: jid,
    mediatype: "image",
    mimetype: "image/jpeg",
    fileName: "oferta.jpg",
    media,
    caption,
  });
}

// ---- Conexão da instância (QR Code) ----

export function evolutionConfigured() {
  return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY);
}

export async function connectionState(): Promise<string> {
  const { instance } = cfg();
  try {
    const r = await call<{ instance?: { state?: string }; state?: string }>(
      "GET",
      `/instance/connectionState/${instance}`,
    );
    return r.instance?.state ?? r.state ?? "unknown";
  } catch (e) {
    if (/404|not exist|não existe/i.test((e as Error).message)) return "missing";
    throw e;
  }
}

type QrResponse = { base64?: string; code?: string; pairingCode?: string; qrcode?: { base64?: string; code?: string } };

export async function createInstance(): Promise<QrResponse> {
  const { instance } = cfg();
  const r = await call<QrResponse>("POST", "/instance/create", {
    instanceName: instance,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  });
  return r.qrcode ?? r;
}

export async function getQr(): Promise<QrResponse> {
  const { instance } = cfg();
  return call<QrResponse>("GET", `/instance/connect/${instance}`);
}

export async function logoutInstance() {
  const { instance } = cfg();
  const { url, key } = cfg();
  await fetch(`${url}/instance/logout/${instance}`, { method: "DELETE", headers: { apikey: key } });
}
