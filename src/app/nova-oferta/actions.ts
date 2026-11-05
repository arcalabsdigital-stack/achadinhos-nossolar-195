"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { batchDateValue } from "@/lib/time";
import { writeOffer } from "@/lib/claude";
import { couponLine } from "@/lib/message";
import { getProduct, shopeeIds, shopeeOriginalPrice, shortLink } from "@/lib/shopee";
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
  for (const k of ["link", "title", "price", "originalPrice", "imageUrl", "coupon", "message"]) {
    const v = field(fd, k);
    if (v) q.set(k, v);
  }
  redirect(`/nova-oferta?${q.toString()}`);
}

export async function addOfferByLink(fd: FormData) {
  const raw = field(fd, "link");
  if (!/^https?:\/\//i.test(raw)) back(fd, "Cole um link começando com https://");

  const t0 = Date.now();
  const log = (m: string) => console.log(`[nova-oferta] ${m} (${Date.now() - t0}ms)`);
  let source = detectSource(raw);
  const finalUrl = await resolveUrl(raw);
  log(`link resolvido: ${source} → ${finalUrl.slice(0, 80)}`);
  if (source === "manual") source = detectSource(finalUrl);

  let externalId: string;
  let affiliateLink: string;
  let productUrl: string;
  let shopId: string | null = null;
  let api: { title?: string; price?: number; originalPrice?: number | null; imageUrl?: string | null } = {};

  if (source === "amazon") {
    const asin = amazonAsin(finalUrl) ?? amazonAsin(raw);
    if (asin) {
      externalId = asin;
      affiliateLink = amazonAffiliateLink(asin);
      productUrl = `https://www.amazon.com.br/dp/${asin}`;
    } else {
      // Link curto da SiteStripe (link.amazon / amzn.to) que não deu para abrir:
      // ele já vem com a tag de Associado, então é usado como está.
      externalId = hashId(raw, true);
      affiliateLink = raw;
      productUrl = raw;
    }
  } else if (source === "shopee" && shopeeIds(finalUrl) && process.env.SHOPEE_APP_ID) {
    // Shopee com API: dados do produto + link curto oficial de afiliado gerado sozinho
    const ids = shopeeIds(finalUrl)!;
    shopId = ids.shopId;
    externalId = ids.itemId;
    productUrl = `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`;
    const alreadyAffiliate = /^(https?:\/\/)?(s\.shopee\.com\.br|shp\.ee|shope\.ee)\//i.test(raw);
    const fresh = await getProduct(ids.shopId, ids.itemId).catch((e) => {
      log(`API Shopee (produto) falhou: ${(e as Error).message}`);
      return null;
    });
    if (fresh) {
      api = {
        title: fresh.productName,
        price: fresh.price,
        originalPrice: shopeeOriginalPrice(fresh.price, fresh.priceDiscountRate),
        imageUrl: fresh.imageUrl,
      };
    }
    affiliateLink = alreadyAffiliate
      ? raw
      : await shortLink(productUrl).catch((e) => {
          log(`API Shopee (link curto) falhou: ${(e as Error).message}`);
          return fresh?.offerLink || "";
        });
    if (!affiliateLink) back(fd, "Não consegui gerar o link de afiliado da Shopee. Cole o link de \"Link personalizado\" e envie de novo.");
    log(`shopee ${ids.itemId} → ${affiliateLink}`);
  } else {
    // Mercado Livre / Shopee sem API / outra loja: o link colado já é o link de afiliado.
    // Atenção: o meli.la redireciona para a vitrine do afiliado (/social/...), que é igual
    // para todos os produtos — então o ID vem do código do anúncio (MLB...) ou do próprio link curto.
    const mlb = (finalUrl.match(/MLB-?(\d{6,})/i) ?? raw.match(/MLB-?(\d{6,})/i))?.[1];
    externalId = mlb ? `MLB${mlb}` : hashId(raw, true);
    affiliateLink = raw;
    productUrl = raw;
  }

  let title = field(fd, "title") || api.title || "";
  let price = parseBRL(field(fd, "price")) ?? api.price;
  let originalPrice = parseBRL(field(fd, "originalPrice")) ?? api.originalPrice ?? undefined;
  let imageUrl = field(fd, "imageUrl") || api.imageUrl || "";
  const coupon = field(fd, "coupon").slice(0, 120);

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

  log("dados do produto ok");
  const s = await getSettings();
  const tone = price <= Number(s.toneThreshold) ? "animado" : "curador";
  const ownMessage = field(fd, "message");
  const copy = ownMessage
    ? { score: 10, reason: "Texto escrito por você", message: ownMessage }
    : await writeOffer({ title, price, originalPrice, lowest30d: null, realDiscountPct: null, rating: null, sales: null, tone, voice: s.voiceNotes });
  if (coupon && !copy.message.includes("🎟️")) copy.message = `${copy.message.trim()}\n${couponLine(coupon)}`;

  log(`texto pronto (${copy.reason})`);
  const product = await prisma.product.upsert({
    where: { source_externalId: { source, externalId } },
    create: { source, externalId, shopId, title, imageUrl: imageUrl || null, productUrl, category: "link" },
    update: { title, imageUrl: imageUrl || null, productUrl, ...(shopId ? { shopId } : {}) },
  });
  await prisma.priceSnapshot.create({ data: { productId: product.id, price } });

  const discount = originalPrice && originalPrice > price ? ((originalPrice - price) / originalPrice) * 100 : null;
  const batchDate = batchDateValue();
  const data = {
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
    coupon: coupon || null,
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
