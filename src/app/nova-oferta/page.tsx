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
        Shopee (enquanto a API não sai): cole o <b>link de afiliado</b> gerado em &quot;Link personalizado&quot;.
      </p>

      {sp.erro && <p className="notice">{sp.erro}</p>}

      <form className="card" action={addOfferByLink}>
        <div className="field">
          <label>Link do produto *</label>
          <input name="link" type="url" required defaultValue={sp.link} placeholder="https://amzn.to/... ou https://s.shopee.com.br/..." />
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
          <label>Texto próprio (deixe vazio para gerar automaticamente)</label>
          <textarea name="message" defaultValue={sp.message} />
        </div>
        <SubmitButton pendingText="⏳ Adicionando… (pode levar até 40 s)">Adicionar ao lote de hoje</SubmitButton>
      </form>
    </>
  );
}
