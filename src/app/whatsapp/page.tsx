import { connectionState, createInstance, evolutionConfigured, getQr } from "@/lib/evolution";
import { disconnect } from "./actions";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  open: "✅ Conectado",
  connecting: "⏳ Aguardando leitura do QR Code",
  close: "❌ Desconectado",
  missing: "Instância ainda não criada",
};

export default async function WhatsApp() {
  if (!evolutionConfigured()) {
    return (
      <>
        <h1>WhatsApp</h1>
        <p className="notice">
          Falta configurar a Evolution. No Railway, no serviço do painel, adicione as variáveis <b>EVOLUTION_URL</b>,{" "}
          <b>EVOLUTION_API_KEY</b> e <b>EVOLUTION_INSTANCE</b> (veja o README).
        </p>
      </>
    );
  }

  let state = "unknown";
  let qr: string | undefined;
  let error = "";
  try {
    state = await connectionState();
    if (state !== "open") {
      const r = state === "missing" ? await createInstance() : await getQr();
      qr = r.base64;
      if (qr && !qr.startsWith("data:")) qr = `data:image/png;base64,${qr}`;
      if (state === "missing") state = "connecting";
    }
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h1>WhatsApp</h1>
      {state !== "open" && !error && <meta httpEquiv="refresh" content="25" />}
      <div className="card">
        <div className="title">Status: {LABEL[state] ?? state}</div>
        <p className="muted">Instância: {process.env.EVOLUTION_INSTANCE ?? "achadinhos"}</p>
        {error && <p className="notice">Erro ao falar com a Evolution: {error}</p>}

        {state === "open" ? (
          <>
            <p>Tudo pronto. Agora vá em <a href="/grupos">Grupos</a> e vincule o grupo #1.</p>
            <form action={disconnect}>
              <button className="danger">Desconectar este WhatsApp</button>
            </form>
          </>
        ) : qr ? (
          <>
            <p>
              No celular do chip: <b>WhatsApp Business → ⋮ / Configurações → Dispositivos conectados → Conectar dispositivo</b>{" "}
              e aponte para o código abaixo. Ele se renova sozinho a cada 25 segundos.
            </p>
            <img src={qr} alt="QR Code do WhatsApp" style={{ width: "100%", maxWidth: 320, background: "#fff", padding: 8, borderRadius: 12 }} />
          </>
        ) : (
          !error && <p>Gerando QR Code… a página atualiza sozinha.</p>
        )}
      </div>
    </>
  );
}
