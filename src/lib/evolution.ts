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

export async function sendImage(jid: string, imageUrl: string, caption: string) {
  const { instance } = cfg();
  return call("POST", `/message/sendMedia/${instance}`, {
    number: jid,
    mediatype: "image",
    mimetype: "image/jpeg",
    media: imageUrl,
    caption,
  });
}
