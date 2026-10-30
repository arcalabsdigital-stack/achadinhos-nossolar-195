export function offerLink(offerId: string) {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}/o/${offerId}`;
}

export function finalMessage(message: string, offerId: string) {
  return `${message.trim()}\n\n👉 ${offerLink(offerId)}`;
}
