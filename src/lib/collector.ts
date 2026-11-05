import { prisma } from "./db";
import { getSettings } from "./settings";
import { searchProducts, type ShopeeProduct } from "./shopee";
import { priceStats } from "./pricing";
import { writeOffer } from "./claude";
import { batchDateValue, todaySP } from "./time";

const MIN_HISTORY_SAMPLES = 7; // dias de histórico antes de confiar só no "desconto real"
const RESEND_COOLDOWN_DAYS = 14;

type Candidate = {
  p: ShopeeProduct;
  productId: string;
  discount: number;
  lowest30d: number | null;
  prelim: number;
};

async function upsertProduct(p: ShopeeProduct, category: string) {
  const product = await prisma.product.upsert({
    where: { source_externalId: { source: "shopee", externalId: p.itemId } },
    create: {
      source: "shopee",
      externalId: p.itemId,
      shopId: p.shopId,
      title: p.productName,
      imageUrl: p.imageUrl,
      productUrl: p.productLink,
      category,
      shopName: p.shopName,
      rating: p.ratingStar,
      sales: p.sales,
    },
    update: { title: p.productName, imageUrl: p.imageUrl, rating: p.ratingStar, sales: p.sales, shopId: p.shopId },
  });
  // um snapshot de preço por dia
  const startOfDay = batchDateValue();
  const already = await prisma.priceSnapshot.findFirst({
    where: { productId: product.id, capturedAt: { gte: startOfDay } },
  });
  if (!already) await prisma.priceSnapshot.create({ data: { productId: product.id, price: p.price } });
  return product.id;
}

export type CollectReport = { created: number; seen: number; candidates: number; errors: string[]; note?: string };

export async function collect(log: (m: string) => void = console.log): Promise<CollectReport> {
  const report: CollectReport = { created: 0, seen: 0, candidates: 0, errors: [] };
  if (!process.env.SHOPEE_APP_ID || !process.env.SHOPEE_APP_SECRET) {
    log("[coletor] credenciais da Shopee ainda não configuradas — coleta automática pulada");
    report.note = "Credenciais da Shopee não configuradas no Railway.";
    return report;
  }
  const s = await getSettings();
  const day = todaySP();
  const batchDate = batchDateValue(day);
  const blocked = s.blockedWords.map((w) => w.toLowerCase());
  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_DAYS * 24 * 3600_000);
  if (!s.keywords.length) {
    report.note = "Nenhuma palavra-chave em Configurações.";
    return report;
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const kw of s.keywords) {
    let products: ShopeeProduct[] = [];
    try {
      products = await searchProducts(kw, { limit: 30, sortType: 2 });
    } catch (e) {
      log(`[coletor] erro em "${kw}": ${(e as Error).message}`);
      report.errors.push(`${kw}: ${(e as Error).message}`);
      if (/signature|credential|auth/i.test((e as Error).message)) break; // erro de credencial: não adianta tentar as outras palavras
      continue;
    }
    for (const p of products) {
      if (seen.has(p.itemId) || !p.price) continue;
      seen.add(p.itemId);
      const productId = await upsertProduct(p, kw);

      const title = p.productName.toLowerCase();
      if (blocked.some((w) => title.includes(w))) continue;
      if ((p.ratingStar ?? 0) < s.minRating) continue;

      const recent = await prisma.offer.findFirst({
        where: { productId, OR: [{ sentAt: { gte: cooldown } }, { batchDate }] },
      });
      if (recent) continue;

      const st = await priceStats(productId, p.price);
      const trustHistory = st.samples >= MIN_HISTORY_SAMPLES;
      const discount = trustHistory ? st.realDiscountPct : (p.priceDiscountRate ?? 0);
      if (discount < s.minRealDiscount) continue;
      if (trustHistory && !st.nearLowest) continue;

      const prelim = discount * (p.ratingStar ?? 4) * (1 + (p.commissionRate ?? 0)) * Math.log10(10 + (p.sales ?? 0));
      candidates.push({ p, productId, discount, lowest30d: st.lowest30d, prelim });
    }
  }

  candidates.sort((a, b) => b.prelim - a.prelim);
  const shortlist = candidates.slice(0, s.batchSize * 2);
  log(`[coletor] ${seen.size} produtos vistos, ${candidates.length} candidatos, avaliando ${shortlist.length}`);

  let created = 0;
  const threshold = Number(s.toneThreshold);
  for (const c of shortlist) {
    if (created >= s.batchSize) break;
    const tone = c.p.price <= threshold ? "animado" : "curador";
    const rate = c.p.priceDiscountRate ?? 0;
    const originalPrice = rate >= 5 && rate < 95 ? Math.round((c.p.price / (1 - rate / 100)) * 100) / 100 : null;
    try {
      const copy = await writeOffer({
        title: c.p.productName,
        price: c.p.price,
        originalPrice,
        lowest30d: c.lowest30d,
        realDiscountPct: c.discount,
        rating: c.p.ratingStar,
        sales: c.p.sales,
        tone,
        voice: s.voiceNotes,
      });
      if (copy.score < 6) continue;
      await prisma.offer.create({
        data: {
          productId: c.productId,
          batchDate,
          price: c.p.price,
          originalPrice,
          lowest30d: c.lowest30d,
          realDiscountPct: c.discount,
          commissionRate: c.p.commissionRate,
          affiliateLink: c.p.offerLink,
          score: copy.score,
          scoreReason: copy.reason,
          tone,
          message: copy.message,
        },
      });
      created++;
    } catch (e) {
      log(`[coletor] falha ao gerar texto: ${(e as Error).message}`);
      report.errors.push(`texto: ${(e as Error).message}`);
    }
  }
  log(`[coletor] lote de ${day}: ${created} ofertas pendentes`);
  return { ...report, created, seen: seen.size, candidates: candidates.length };
}
