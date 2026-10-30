"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { batchDateValue } from "@/lib/time";
import { writeOffer } from "@/lib/claude";
import {
  amazonAffiliateLink,
  amazonAsin,
  detectSource,
  fetchMeta,
  hashId,
  parseBRL,
  resolveUrl,
} from "@/lib/links";

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function back(fd: FormData, erro: string): never {
  const q = new URLSearchParams({ erro });
  for (const k of ["link", "title", "price", "originalPrice", "imageUrl", "message"]) {
    const v = field(fd, k);
    if (v) q.set(k, v);
  }
  redirect(`/nova-oferta?${q.toString()}`);
}

export async function addOfferByLink(fd: FormData) {
  const raw = field(fd, "link");
  if (!/^https?:\/\//i.test(raw)) back(fd, "Cole um link começando com https://");

  let source = detectSource(raw);
  const finalUrl = await resolveUrl(raw);
  if (source === "manual") source = detectSource(finalUrl);

  let externalId: string;
  let affiliateLink: string;
  let productUrl: string;

  if (source === "amazon") {
    const asin = amazonAsin(finalUrl) ?? amazonAsin(raw);
    if (asin) {
      externalId = asin;
      affiliateLink = amazonAffiliateLink(asin);
      productUrl = `https://www.amazon.com.br/dp/${asin}`;
    } else {
      // Link curto da SiteStripe (link.amazon / amzn.to) que não deu para abrir:
      // ele já vem com a tag de Associado, então é usado como está.
      externalId = hashId(raw);
      affiliateLink = raw;
      productUrl = finalUrl;
    }
  } else {
    // Shopee sem API ou outra loja: o link colado já deve ser o link de afiliado
    externalId = hashId(finalUrl);
    affiliateLink = raw;
    productUrl = finalUrl;
  }

  let title = field(fd, "title");
  let price = parseBRL(field(fd, "price"));
  let originalPrice = parseBRL(field(fd, "originalPrice"));
  let imageUrl = field(fd, "imageUrl");

  if (!title || !price || !imageUrl) {
    const meta = await fetchMeta(source === "amazon" ? productUrl : finalUrl);
    title ||= meta.title ?? "";
    price ??= meta.price;
    originalPrice ??= meta.originalPrice;
    imageUrl ||= meta.imageUrl ?? "";
  }
  if (!title || !price) {
    back(fd, "Não consegui ler o produto automaticamente. Preencha o nome e o preço e envie de novo.");
  }

  const s = await getSettings();
  const tone = price <= Number(s.toneThreshold) ? "animado" : "curador";
  const ownMessage = field(fd, "message");
  const copy = ownMessage
    ? { score: 10, reason: "Texto escrito por você", message: ownMessage }
    : await writeOffer({ title, price, originalPrice, lowest30d: null, realDiscountPct: null, rating: null, sales: null, tone });

  const product = await prisma.product.upsert({
    where: { source_externalId: { source, externalId } },
    create: { source, externalId, title, imageUrl: imageUrl || null, productUrl, category: "link" },
    update: { title, imageUrl: imageUrl || null, productUrl },
  });
  await prisma.priceSnapshot.create({ data: { productId: product.id, price } });

  const discount = originalPrice && originalPrice > price ? ((originalPrice - price) / originalPrice) * 100 : null;
  const batchDate = batchDateValue();
  const data = {
    price,
    realDiscountPct: discount,
    affiliateLink,
    score: copy.score,
    scoreReason: copy.reason,
    tone: tone as "animado" | "curador",
    message: copy.message,
    status: "pending" as const,
    slotAt: null,
  };
  await prisma.offer.upsert({
    where: { productId_batchDate: { productId: product.id, batchDate } },
    create: { productId: product.id, batchDate, ...data },
    update: data,
  });

  revalidatePath("/aprovacao");
  redirect("/aprovacao?nova=1");
}
