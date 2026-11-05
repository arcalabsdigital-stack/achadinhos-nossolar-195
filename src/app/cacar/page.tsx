import { bookmarkletCode } from "@/lib/bookmarklet";

export const dynamic = "force-dynamic";

const LINKS: { title: string; url: string; note: string }[] = [
  { title: "Ofertas do Dia — Amazon", url: "https://www.amazon.com.br/deals", note: "Filtre por Casa, Cozinha e Organização" },
  { title: "Mais vendidos em Casa", url: "https://www.amazon.com.br/gp/bestsellers/home", note: "O que já vende bem" },
  { title: "Mais vendidos em Cozinha", url: "https://www.amazon.com.br/gp/bestsellers/kitchen", note: "Utensílios, potes, eletroportáteis" },
  { title: "Em alta em Casa (subindo rápido)", url: "https://www.amazon.com.br/gp/movers-and-shakers/home", note: "Produtos ganhando vendas agora" },
  { title: "Em alta em Cozinha", url: "https://www.amazon.com.br/gp/movers-and-shakers/kitchen", note: "Produtos ganhando vendas agora" },
  { title: "Mercado Livre — Hub de afiliados (Ganhos extras)", url: "https://www.mercadolivre.com.br/afiliados/hub", note: "Filtre por Ganhos extras + categoria: comissões maiores" },
  { title: "Ofertas da Shopee (painel de afiliado)", url: "https://affiliate.shopee.com.br/offer/product_offer", note: "Gere o link em “Obter link” e cole em ➕ Oferta" },
];

export default function Cacar() {
  const href = bookmarkletCode(process.env.APP_URL ?? "");
  return (
    <>
      <h1>Caçar ofertas</h1>

      <div className="card">
        <div className="title">1. Instale o botão (uma vez só, no computador)</div>
        <p className="muted">
          Mostre a barra de favoritos (Ctrl+Shift+B no Chrome) e <b>arraste o botão abaixo para ela</b>.
        </p>
        <p
          dangerouslySetInnerHTML={{
            __html: `<a href="${href}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#2f7d4f;color:#fff;font-weight:600;text-decoration:none">➕ Achadinhos</a>`,
          }}
        />
        <div className="title" style={{ marginTop: 12 }}>2. Use</div>
        <p className="muted">
          Abra a página de um produto na <b>Amazon</b>, no <b>Mercado Livre</b> ou na <b>Shopee</b> e clique em <b>➕ Achadinhos</b> na barra de
          favoritos. O painel abre com nome, preço, preço antigo e foto preenchidos. Na Amazon a tag de associado é aplicada
          sozinha; no Mercado Livre, cole o seu link meli.la no campo Link. Depois é só clicar em <b>Adicionar</b>.
          <br />
          (Se você já tinha o botão, arraste de novo para atualizar — a versão nova também funciona na Shopee e pega o cupom da página.)
        </p>
      </div>

      <h2>Onde procurar</h2>
      {LINKS.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card">
            <div className="title">{l.title} ↗</div>
            <div className="muted">{l.note}</div>
          </div>
        </a>
      ))}

      <h2>O que costuma vender em grupo</h2>
      <div className="card muted">
        Até R$ 80 · desconto visível (preço riscado) · avaliação 4,5+ com muitas avaliações · resolve um problema do dia a dia
        (organização, limpeza, cozinha prática) · foto clara do produto.
      </div>
    </>
  );
}
