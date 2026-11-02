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
  /** Regras de voz definidas no painel (Configurações) */
  voice?: string;
};

export type CopyResult = { score: number; reason: string; message: string };

/** Voz padrão do @nossolar195 (a Taty fala com o público, majoritariamente feminino, como "amigonas") */
export const DEFAULT_VOICE = `Quem fala é a Taty, do @nossolar195. O público é majoritariamente feminino e ela chama as seguidoras de "amigona" / "amigonas".
- Quando o produto agrada principalmente mulheres ou é bom de presente (bem-estar, decoração, cozinha bonita, organização, conforto), chame a leitora de "amigona" ou "amigonas", de forma natural (no início, no meio ou no fim).
- Em produtos neutros (ferramenta, pilha, limpeza pesada, eletrônico), o vocativo é opcional.
- Recado para o marido (só quando pedido): a Taty fala com os maridos/namorados das seguidoras sugerindo dar o produto de presente para "minha amigona" (sempre no singular). Crie uma frase nova a cada vez. Ideias de tom, NÃO copie: chamar o marido de "maridão" ou "marido da casa", dizer que ela vai adorar / ficar toda feliz / se apaixonar / agradecer, sugerir surpreender, dar a dica de presente.
- Nunca use linguagem de homem falando, nem termos genéricos como "galera" ou "pessoal".`;

const OPENINGS = [
  "comece com uma pergunta para a leitora",
  "comece pelo benefício principal do produto",
  "comece com uma exclamação curta e um emoji",
  "comece pelo nome do produto em negrito",
  "comece pelo preço ou pelo desconto",
  "comece contando o problema do dia a dia que o produto resolve",
  "comece com uma frase curta de achado (ex.: tom de quem descobriu algo bom)",
  "comece chamando a amigona pelo vocativo",
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Sorteia a variação de cada mensagem (a IA sozinha não garante o "de vez em quando") */
function voiceVariation(): string {
  const opening = `Abertura desta mensagem: ${pick(OPENINGS)}.`;
  const r = Math.random();
  const variation =
    r < 0.2
      ? "Variação desta mensagem: SE o produto for um bom presente para uma mulher, inclua um recado curto para o marido/namorado (frase nova, sem copiar exemplos). Se não combinar com presente, NÃO fale de marido."
      : r < 0.6
        ? 'Variação desta mensagem: NÃO fale de marido. Se usar vocativo, use "amigona" (singular).'
        : 'Variação desta mensagem: NÃO fale de marido. Se usar vocativo, use "amigonas" (plural).';
  return `${opening}\n${variation}`;
}

const SYSTEM = `Você escreve ofertas para o grupo de WhatsApp "Achadinhos Nosso Lar", da Taty (Instagram @taty_schneiders / @nossolar195).
O público é majoritariamente feminino (as "amigonas"). O grupo traz tudo o que a Taty indicaria para uma amiga:
casa, cozinha, organização, limpeza, decoração, beleza e cuidados pessoais, moda e acessórios femininos, infantil e bebê,
bem-estar, presentes e tecnologia útil para o dia a dia.

Tarefa: avaliar o produto e escrever a mensagem.
- score: 0 a 10 — quanto o produto interessa a esse público E se é uma boa oferta (desconto, preço acessível, utilidade).
  Notas altas (8–10): útil ou desejado pelas amigonas, preço atrativo, bom desconto.
  Notas médias (5–7): interessa, mas é caro, sem desconto claro ou muito específico.
  Notas baixas (0–4): pouco a ver com esse público (ex.: peça automotiva, ferramenta profissional, item masculino de nicho)
  ou oferta fraca.
- reason: uma frase curta explicando a nota.
- message: texto da oferta para WhatsApp, em português do Brasil, no máximo 6 linhas curtas.
  Use *negrito* do WhatsApp no nome curto do produto.
  NÃO escreva preço nem valores em R$ no texto: a linha de preço (com o preço antigo riscado) é adicionada
  automaticamente no final. NÃO inclua link. NÃO invente características que não estão no título.

Tons:
- animado (produtos baratos): energia, emojis, urgência leve.
- curador (produtos mais caros): calmo, confiável, foca em utilidade e qualidade.

VARIEDADE (muito importante — as mensagens saem uma atrás da outra no mesmo grupo):
- Siga a "Abertura desta mensagem" indicada no pedido. NUNCA comece com "Avaliamos e vale a pena".
- Nunca copie frases de exemplo literalmente; escreva sempre uma frase nova, com outras palavras.
- Varie verbos e expressões (amar, adorar, ficar toda feliz, se apaixonar, agradecer, não largar mais…).

RECADO PARA O MARIDO: só fale com o marido/namorado quando a linha "Variação desta mensagem" pedir isso
E o produto combinar com presente. Em qualquer outro caso, não mencione marido.

Responda SOMENTE com JSON: {"score": number, "reason": string, "message": string}

VOZ E ESTILO (siga sempre):
`;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto padrão, usado quando não há chave da Claude configurada */
/**
 * Linha de preço padronizada (formato de grupo de ofertas):
 *   🔥 ~DE R$ 199,00~ | *POR R$ 185,90*
 * O "~texto~" é o riscado do WhatsApp. Sem preço antigo: 💰 *POR R$ 185,90*
 */
export function priceLine(price: number, originalPrice?: number | null) {
  if (originalPrice && originalPrice > price) {
    const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
    return `🔥 ~DE ${brl(originalPrice)}~ | *POR ${brl(price)}*${pct >= 10 ? ` (-${pct}%)` : ""}`;
  }
  return `💰 *POR ${brl(price)}*`;
}

/** Junta o texto da IA (sem preços) com a linha de preço padronizada */
function withPrice(text: string, price: number, originalPrice?: number | null) {
  // remove alguma linha de preço que a IA tenha escrito mesmo assim
  const clean = text
    .split("\n")
    .filter((l) => !/R\$\s?\d/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${clean}\n\n${priceLine(price, originalPrice)}`;
}

/** Texto padrão, usado quando não há IA configurada ou ela falha */
export function templateOffer(input: CopyInput & { originalPrice?: number | null }): CopyResult {
  const name = input.title.length > 70 ? input.title.slice(0, 67) + "..." : input.title;
  const amiga = Math.random() < 0.5 ? "amigona" : "amigonas";
  const body =
    input.tone === "animado"
      ? `🔥 *${name}*\n⚡ Corre, ${amiga}, que oferta assim acaba rápido!`
      : `🏠 *${name}*\nAchado que vale a pena pra sua casa, ${amiga}.`;
  return { score: 7, reason: "Texto padrão (sem IA)", message: withPrice(body, input.price, input.originalPrice) };
}

/**
 * Gemini (Google AI Studio) — tem plano gratuito. Usado quando GEMINI_API_KEY está configurada.
 * No plano gratuito o modelo principal às vezes responde 503 ("high demand"); por isso tenta
 * modelos alternativos em sequência antes de cair no texto padrão.
 */
const GEMINI_FALLBACKS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite"];

async function geminiOnce(model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Gemini ${res.status} (${model}): ${json.error?.message ?? "erro"}`);
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.includes("{")) throw new Error(`Gemini (${model}) respondeu sem JSON`);
  return text;
}

async function askGemini(system: string, user: string): Promise<string> {
  const models = [...new Set([process.env.GEMINI_MODEL || "gemini-flash-latest", ...GEMINI_FALLBACKS])];
  let lastError: Error = new Error("sem modelos");
  for (const model of models) {
    try {
      return await geminiOnce(model, system, user);
    } catch (e) {
      lastError = e as Error;
      console.warn(`[ia] ${lastError.message} — tentando o próximo modelo`);
    }
  }
  throw lastError;
}

async function askClaude(system: string, user: string): Promise<string> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: user }],
  }, { timeout: 25_000 });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export function aiProvider(): "gemini" | "claude" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

export async function writeOffer(input: CopyInput & { originalPrice?: number | null }): Promise<CopyResult> {
  const provider = aiProvider();
  if (!provider) return templateOffer(input);
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
    voiceVariation(),
  ].filter(Boolean);
  const system = SYSTEM + (input.voice?.trim() || DEFAULT_VOICE);

  let text: string;
  try {
    text = provider === "gemini" ? await askGemini(system, facts.join("\n")) : await askClaude(system, facts.join("\n"));
  } catch (e) {
    console.error(`[ia] ${provider} falhou, usando texto padrão:`, (e as Error).message);
    return templateOffer(input);
  }
  try {
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as CopyResult;
    if (!parsed.message) throw new Error("resposta sem texto");
    return {
      score: Number(parsed.score) || 0,
      reason: String(parsed.reason ?? ""),
      message: withPrice(String(parsed.message), input.price, input.originalPrice),
    };
  } catch (e) {
    console.error(`[ia] resposta inválida do ${provider}:`, (e as Error).message);
    return templateOffer(input);
  }
}
