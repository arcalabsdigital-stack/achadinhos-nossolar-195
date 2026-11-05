import SubmitButton from "@/components/SubmitButton";
import { addCoupon } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function Cupom({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { erro } = sp;
  const mlNeedsLink = sp.via === "favorito" && sp.store === "ml" && !/meli\.la/.test(sp.link ?? "");
  return (
    <>
      <h1>🎟️ Postar cupom</h1>
      <p className="muted">
        O post entra no lote de hoje para você aprovar e sai no próximo horário livre. A comissão vem do <b>link</b>: use um
        link de afiliado (meli.la, s.shopee.com.br) ou um link da Amazon — a tag é aplicada sozinha.
      </p>
      {erro && <p className="notice">{erro}</p>}
      {sp.via === "favorito" && !erro && (
        <p className="notice">
          Cupom lido da página. Confira os campos{mlNeedsLink ? <> e <b>troque o Link pelo seu link meli.la</b> (sem ele não há comissão)</> : null}
          {sp.store === "shopee" ? " — o link de afiliado da Shopee é gerado sozinho." : null}
        </p>
      )}
      <form className="card" action={addCoupon}>
        <div className="field">
          <label>Loja *</label>
          <select name="store" defaultValue={sp.store ?? "ml"}>
            <option value="ml">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
          </select>
        </div>
        <div className="flex">
          <div className="field" style={{ flex: 1 }}>
            <label>Código do cupom</label>
            <input name="code" defaultValue={sp.code} placeholder="OFERTAMELI (vazio = cupom de ativar na página)" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Desconto *</label>
            <input name="discount" required defaultValue={sp.discount} placeholder="25% OFF (até R$ 80)" />
          </div>
        </div>
        <div className="flex">
          <div className="field" style={{ flex: 1 }}>
            <label>Compra mínima</label>
            <input name="minimum" defaultValue={sp.minimum} placeholder="R$ 99" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Validade</label>
            <input name="validity" defaultValue={sp.validity} placeholder="Válido só hoje" />
          </div>
        </div>
        <div className="field">
          <label>Link *</label>
          <input name="link" type="url" required defaultValue={sp.link} placeholder="https://meli.la/… · https://s.shopee.com.br/… · https://www.amazon.com.br/…" />
        </div>
        <div className="field">
          <label>Observação (opcional)</label>
          <textarea name="note" placeholder="Ex.: vale para casa e cozinha" />
        </div>
        <SubmitButton pendingText="⏳ Adicionando…">Adicionar ao lote de hoje</SubmitButton>
      </form>
    </>
  );
}
