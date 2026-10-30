import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export type CopyInput = {
  title: string;
  price: number;
  lowest30d: number | null;
  realDiscountPct: number | null;
  rating: number | null;
  sales: number | null;
  tone: "animado" | "curador";
};

export type CopyResult = { score: number; reason: string; message: string };

const SYSTEM = `Você escreve ofertas para o grupo de WhatsApp "Achadinhos Nosso Lar", do Instagram @nossolar195 (conteúdo de casa e rotina).
O público quer produtos úteis para casa: cozinha, organização, limpeza e decoração.

Tarefa: avaliar o produto e escrever a mensagem.
- score: 0 a 10 — quão bem o produto combina com o nicho casa/rotina e se é uma boa oferta. Produtos fora do nicho (roupa, eletrônico pessoal, beleza etc.) recebem no máximo 3.
- reason: uma frase curta explicando a nota.
- message: texto da oferta para WhatsApp, em português do Brasil, no máximo 6 linhas curtas.
  Use *negrito* do WhatsApp no nome curto do produto e no preço.
  NÃO inclua link (ele é adicionado depois). NÃO invente características que não estão no título.
  Mostre o preço como "R$ 00,00". Se houver preço antigo de referência, mostre "de R$ X por R$ Y".

Tons:
- animado (produtos baratos): energia, emojis (🔥⚡😱), urgência leve. Ex.: "CORRE que tá barato!"
- curador (produtos mais caros): calmo, confiável, foca em utilidade e qualidade. Ex.: "Avaliamos e vale a pena: ..."

Responda SOMENTE com JSON: {"score": number, "reason": string, "message": string}`;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto padrão, usado quando não há chave da Claude configurada */
export function templateOffer(input: CopyInput & { originalPrice?: number | null }): CopyResult {
  const name = input.title.length > 70 ? input.title.slice(0, 67) + "..." : input.title;
  const old = input.originalPrice && input.originalPrice > input.price ? `de ~${brl(input.originalPrice)}~ ` : "";
  const message =
    input.tone === "animado"
      ? `🔥 *${name}*\n\n${old}por *${brl(input.price)}* 😱\n⚡ Corre que oferta assim acaba rápido!`
      : `🏠 *${name}*\n\nAchado que vale a pena pra sua casa.\n${old}por *${brl(input.price)}*`;
  return { score: 7, reason: "Texto padrão (sem Claude)", message };
}

export async function writeOffer(input: CopyInput & { originalPrice?: number | null }): Promise<CopyResult> {
  if (!process.env.ANTHROPIC_API_KEY) return templateOffer(input);
  const facts = [
    `Produto: ${input.title}`,
    `Preço atual: ${brl(input.price)}`,
    input.originalPrice && input.originalPrice > input.price
      ? `Preço antigo informado pela loja: ${brl(input.originalPrice)}`
      : input.lowest30d && input.realDiscountPct && input.realDiscountPct > 0
        ? `Preço de referência (maior dos últimos 30 dias): ${brl(input.price / (1 - input.realDiscountPct / 100))}`
        : null,
    input.rating ? `Avaliação: ${input.rating.toFixed(1)} estrelas` : null,
    input.sales ? `Vendidos: ${input.sales}` : null,
    `Tom: ${input.tone}`,
  ].filter(Boolean);

  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: facts.join("\n") }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as CopyResult;
  return { score: Number(parsed.score) || 0, reason: String(parsed.reason ?? ""), message: String(parsed.message ?? "") };
}
