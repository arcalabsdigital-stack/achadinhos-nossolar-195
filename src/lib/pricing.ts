import { prisma } from "./db";

/**
 * Desconto real = quanto o preço atual está abaixo do MAIOR preço visto nos últimos 30 dias,
 * comparado também com o menor preço do período (evita "desconto" de preço inflado).
 */
export async function priceStats(productId: string, currentPrice: number) {
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const agg = await prisma.priceSnapshot.aggregate({
    where: { productId, capturedAt: { gte: since } },
    _min: { price: true },
    _max: { price: true },
    _count: true,
  });
  const lowest = agg._min.price ? Number(agg._min.price) : null;
  const highest = agg._max.price ? Number(agg._max.price) : null;
  const realDiscountPct = highest && highest > currentPrice ? ((highest - currentPrice) / highest) * 100 : 0;
  // Está no menor preço (ou até 3% acima) do período?
  const nearLowest = lowest === null || currentPrice <= lowest * 1.03;
  return { lowest30d: lowest, highest30d: highest, realDiscountPct, nearLowest, samples: agg._count };
}
