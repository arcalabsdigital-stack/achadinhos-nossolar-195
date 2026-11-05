import crypto from "node:crypto";
import { prisma } from "./db";
import { priceLine } from "./claude";

/** Domínio dos links curtos: SHORT_URL (domínio próprio, ex. https://nl195.com.br) ou APP_URL */
function base() {
  return (process.env.SHORT_URL || process.env.APP_URL || "").replace(/\/$/, "");
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function randomCode(n = 6) {
  const b = crypto.randomBytes(n);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

/** Garante um código curto para a oferta e devolve o link /o/<code> */
export async function offerLink(offer: { id: string; code: string | null }) {
  let code = offer.code;
  for (let i = 0; !code && i < 5; i++) {
    const c = randomCode();
    if (await prisma.offer.findFirst({ where: { code: c }, select: { id: true } })) continue; // colisão: tenta outro
    await prisma.offer.update({ where: { id: offer.id }, data: { code: c } });
    code = c;
  }
  return `${base()}/o/${code ?? offer.id}`;
}

/** Troca a linha de preço do texto pela versão padrão (com preço antigo riscado, se houver) */
export function refreshPriceLine(message: string, price: number, originalPrice: number | null) {
  const line = priceLine(price, originalPrice);
  const lines = message.trim().split("\n");
  const i = lines.findLastIndex((l) => /POR\s*R\$/.test(l));
  if (i >= 0) lines[i] = line;
  return lines.join("\n");
}

/**
 * Amazon: o link vai direto para a Amazon (as regras do programa de Associados
 * não permitem esconder o destino atrás de redirecionador próprio).
 * Links curtos da loja (meli.la, s.shopee.com.br) também vão direto; longos usam /o/<code>.
 */
export async function finalMessage(
  offer: { id: string; code: string | null; message: string; affiliateLink: string; price: unknown; originalPrice: unknown },
  source: string,
) {
  // Amazon, e links curtos da própria loja (meli.la, s.shopee.com.br…) vão direto, como no Economi-Z.
  // Só links longos passam pelo nosso /o/<código>.
  const direct = source === "amazon" || offer.affiliateLink.length <= 40;
  const link = direct ? offer.affiliateLink : await offerLink(offer);
  const op = offer.originalPrice == null ? null : Number(offer.originalPrice);
  const text = refreshPriceLine(offer.message, Number(offer.price), op);
  return `${text}\n\n👉 ${link}`;
}
