import { amazonTag } from "@/lib/links";
import { addOfferByLink } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function NovaOferta({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Adicionar oferta por link</h1>
      <p className="muted">
        Amazon: cole o link de qualquer produto — a tag <b>{amazonTag()}</b> é aplicada sozinha.
        <br />
        Mercado Livre: cole o link de afiliado (meli.la/…).
        <br />
        Shopee: cole o link de qualquer produto — o link de afiliado é gerado sozinho pela API.
      </p>

      {sp.via === "favorito" && !sp.erro && sp.site === "shopee" && (
        <p className="notice">
          Produto da Shopee identificado. Nome, preço, foto e o seu link de afiliado vêm da API ao clicar em <b>Adicionar ao lote de hoje</b>.
        </p>
      )}
      {sp.via === "favorito" && !sp.erro && sp.site === "amazon" && (
        <p className="notice">
          Dados lidos da página da Amazon. Confira nome, preço e preço antigo e clique em <b>Adicionar ao lote de hoje</b>.
        </p>
      )}
      {sp.via === "favorito" && !sp.erro && sp.site === "ml" && sp.link && (
        <p className="notice">
          Dados e link de afiliado (meli.la) lidos do Mercado Livre. Confira e clique em <b>Adicionar ao lote de hoje</b>.
        </p>
      )}
      {sp.via === "favorito" && !sp.erro && sp.site === "ml" && !sp.link && (
        <p className="notice">
          Dados lidos do Mercado Livre. Agora <b>cole o seu link de afiliado</b> (meli.la/… — botão &quot;Compartilhar&quot; da
          barra de afiliados no topo da página do produto, ou o Gerador de links) no campo Link e clique em Adicionar.
        </p>
      )}
      {sp.erro && <p className="notice">{sp.erro}</p>}

      <form className="card" action={addOfferByLink}>
        <div className="field">
          <label>Link do produto *</label>
          <input name="link" type="url" required defaultValue={sp.link} placeholder="https://amzn.to/…, https://meli.la/… ou https://s.shopee.com.br/…" />
        </div>
        <p className="muted">
          Os campos abaixo são opcionais: o sistema tenta ler da página. Se não conseguir, ele pede para você preencher.
        </p>
        <div className="field">
          <label>Nome do produto</label>
          <input name="title" defaultValue={sp.title} />
        </div>
        <div className="flex">
          <div className="field" style={{ flex: 1 }}>
            <label>Preço atual (R$)</label>
            <input name="price" inputMode="decimal" defaultValue={sp.price} placeholder="49,90" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Preço antigo (R$)</label>
            <input name="originalPrice" inputMode="decimal" defaultValue={sp.originalPrice} placeholder="79,90" />
          </div>
        </div>
        <div className="field">
          <label>Link da imagem</label>
          <input name="imageUrl" defaultValue={sp.imageUrl} placeholder="https://..." />
        </div>
        <div className="field">
          <label>Cupom (opcional)</label>
          <input name="coupon" defaultValue={sp.coupon} placeholder="Ex.: OFERTAMELI ou Cupom 10% OFF" />
          {sp.via === "favorito" && sp.coupon && <p className="muted">🎟️ Cupom encontrado na página — confira se vale para este produto.</p>}
        </div>
        <div className="field">
          <label>Texto próprio (deixe vazio para gerar automaticamente)</label>
          <textarea name="message" defaultValue={sp.message} />
        </div>
        <SubmitButton pendingText="⏳ Adicionando… (pode levar até 40 s)">Adicionar ao lote de hoje</SubmitButton>
      </form>
    </>
  );
}
