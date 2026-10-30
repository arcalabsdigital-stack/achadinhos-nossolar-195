import { getSettings } from "@/lib/settings";
import { saveSettings } from "./actions";
import { DEFAULT_VOICE } from "@/lib/claude";

export const dynamic = "force-dynamic";

export default async function Config() {
  const s = await getSettings();
  const live = process.env.SENDING_ENABLED === "true";
  return (
    <>
      <h1>Configurações</h1>
      <p className={live ? "muted" : "notice"}>
        Envio: <b>{live ? "REAL — mensagens vão para o WhatsApp" : "SIMULAÇÃO — nada é enviado ao WhatsApp"}</b>
        {!live && " (para ligar, defina SENDING_ENABLED=true no Railway)"}
      </p>
      <form action={saveSettings} className="card">
        <div className="field">
          <label>Horários de envio (um por linha, HH:MM)</label>
          <textarea name="slots" defaultValue={s.slots.join("\n")} style={{ minHeight: 120 }} />
        </div>
        <div className="flex">
          <div className="field" style={{ flex: 1 }}>
            <label>Ofertas por lote</label>
            <input name="batchSize" type="number" defaultValue={s.batchSize} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Tom curador acima de (R$)</label>
            <input name="toneThreshold" type="number" step="1" defaultValue={Number(s.toneThreshold)} />
          </div>
        </div>
        <div className="flex">
          <div className="field" style={{ flex: 1 }}>
            <label>Desconto real mínimo (%)</label>
            <input name="minRealDiscount" type="number" defaultValue={s.minRealDiscount} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Avaliação mínima</label>
            <input name="minRating" type="number" step="0.1" defaultValue={s.minRating} />
          </div>
        </div>
        <div className="field">
          <label>Palavras-chave de busca (uma por linha)</label>
          <textarea name="keywords" defaultValue={s.keywords.join("\n")} style={{ minHeight: 200 }} />
        </div>
        <div className="field">
          <label>Palavras bloqueadas (uma por linha)</label>
          <textarea name="blockedWords" defaultValue={s.blockedWords.join("\n")} />
        </div>
        <div className="field">
          <label>Voz das mensagens (como a IA deve escrever)</label>
          <textarea name="voiceNotes" defaultValue={s.voiceNotes || DEFAULT_VOICE} style={{ minHeight: 220 }} />
          <p className="muted">
            O sistema sorteia em cada mensagem: &quot;amigona&quot; (40%), &quot;amigonas&quot; (40%) ou falar com o marido (20%,
            só quando o produto combina com presente).
          </p>
        </div>
        <button className="primary">Salvar</button>
      </form>
    </>
  );
}
