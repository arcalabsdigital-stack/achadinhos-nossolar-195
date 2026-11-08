import { prisma } from "./db";
import { getSettings } from "./settings";
import { writeOffer } from "./claude";
import { batchDateValue } from "./time";

const RESEND_COOLDOWN_DAYS = 14;

export type MlItem = {
  id: string; // MLB123…
  url: string;
  title: string;
  price: number;
  old?: number;
  img?: string;
  rating?: number;
  commission?: number; // % (ex.: 16)
};

export type ImportReport = { seen: number; candidates: number; created: number; errors: string[] };

/**
 * Lote do Mercado Livre importado da página que o Marcos está vendo (Ofertas do dia, Hub de afiliados…).
 * Filtra, ranqueia, a IA escreve os melhores e eles entram pendentes SEM link — o meli.la é colocado
 * depois, só nas ofertas escolhidas.
 */
export async function importMlList(raw: MlItem[]): Promise<ImportReport> {
  const s = await getSettings();
  const batchDate = batchDateValue();
  const blocked = s.blockedWords.map((w) => w.toLowerCase());
  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_DAYS * 24 * 3600_000);
  const report: ImportReport = { seen: 0, candidates: 0, created: 0, errors: [] };

  const items = new Map<string, MlItem>();
  for (const it of raw ?? []) {
    const id = String(it?.id ?? "").toUpperCase();
    const price = Number(it?.price);
    if (!/^MLB\d{6,}$/.test(id) || !it.title || !(price > 0) || items.has(id)) continue;
    items.set(id, { ...it, id, price, old: Number(it.old) || undefined, title: String(it.title).slice(0, 200) });
  }
  report.seen = items.size;

  type C = { it: MlItem; productId: string; discount: number; prelim: number };
  const cands: C[] = [];
  for (const it of items.values()) {
    if (blocked.some((w) => it.title.toLowerCase().includes(w))) continue;
    if (it.rating && it.rating < s.minRating) continue;
    const discount = it.old && it.old > it.price ? Math.round(((it.old - it.price) / it.old) * 100) : 0;
    const commission = it.commission ?? 0;
    if (discount < s.minRealDiscount && commission < 12) continue;

    const url = it.url.split("#")[0];
    const product = await prisma.product.upsert({
      where: { source_externalId: { source: "manual", externalId: it.id } },
      create: { source: "manual", externalId: it.id, title: it.title, imageUrl: it.img || null, productUrl: url, category: "ml-lote", rating: it.rating ?? null },
      update: { title: it.title, imageUrl: it.img || null, productUrl: url, ...(it.rating ? { rating: it.rating } : {}) },
    });
    const recent = await prisma.offer.findFirst({
      where: { productId: product.id, OR: [{ sentAt: { gte: cooldown } }, { batchDate }] },
      select: { id: true },
    });
    if (recent) continue;
    const prelim = (discount + 5) * (it.rating ?? 4.5) * (1 + (commission / 100) * 3);
    cands.push({ it, productId: product.id, discount, prelim });
  }
  report.candidates = cands.length;
  cands.sort((a, b) => b.prelim - a.prelim);
  const shortlist = cands.slice(0, s.batchSize * 2);
  const threshold = Number(s.toneThreshold);

  // IA em paralelo (4 por vez) para não demorar
  let next = 0;
  const worker = async () => {
    while (next < shortlist.length && report.created < s.batchSize) {
      const c = shortlist[next++];
      const originalPrice = c.it.old && c.it.old > c.it.price ? c.it.old : null;
      const tone = c.it.price <= threshold ? "animado" : "curador";
      try {
        const copy = await writeOffer({
          title: c.it.title,
          price: c.it.price,
          originalPrice,
          lowest30d: null,
          realDiscountPct: c.discount || null,
          rating: c.it.rating ?? null,
          sales: null,
          tone,
          voice: s.voiceNotes,
        });
        if (copy.score < 6 || report.created >= s.batchSize) continue;
        await prisma.offer.create({
          data: {
            productId: c.productId,
            batchDate,
            price: c.it.price,
            originalPrice,
            realDiscountPct: c.discount || null,
            commissionRate: c.it.commission ? c.it.commission / 100 : null,
            affiliateLink: "", // falta o meli.la
            score: copy.score,
            scoreReason: copy.reason,
            tone,
            message: copy.message,
          },
        });
        report.created++;
      } catch (e) {
        report.errors.push((e as Error).message);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return report;
}
