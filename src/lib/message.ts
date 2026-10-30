export function offerLink(offerId: string) {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}/o/${offerId}`;
}

/**
 * Amazon: o link vai direto para a Amazon (as regras do programa de Associados
 * não permitem esconder o destino atrás de redirecionador próprio).
 * Shopee/manual: link curto rastreável /o/[id].
 */
export function finalMessage(message: string, offerId: string, source: string, affiliateLink: string) {
  const link = source === "amazon" ? affiliateLink : offerLink(offerId);
  return `${message.trim()}\n\n👉 ${link}`;
}
