import { prisma } from "./db";
import { getProduct } from "./shopee";
import { sendImage, sendText, fetchGroups } from "./evolution";
import { finalMessage } from "./message";
import { buildOfferCard, hiResImageUrl } from "./card";

const PRICE_TOLERANCE = 1.05; // aceita até 5% de alta antes de cancelar
const MAX_DELAY_MS = 2 * 3600_000; // slot perdido há mais de 2h é descartado
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processDueOffers(log: (m: string) => void = console.log) {
  const now = new Date();
  const due = await prisma.offer.findMany({
    where: { status: "scheduled", slotAt: { lte: now } },
    include: { product: true },
    orderBy: { slotAt: "asc" },
  });
  if (!due.length) return;

  const groups = await prisma.group.findMany({ where: { active: true, jid: { not: null } }, orderBy: { order: "asc" } });
  const live = process.env.SENDING_ENABLED === "true";

  for (const offer of due) {
    if (now.getTime() - offer.slotAt!.getTime() > MAX_DELAY_MS) {
      await prisma.offer.update({ where: { id: offer.id }, data: { status: "expired", rejectReason: "Horário perdido" } });
      continue;
    }

    // Reverifica preço na Shopee antes de enviar
    if (offer.product.source === "shopee" && offer.product.shopId && process.env.SHOPEE_APP_ID) {
      try {
        const fresh = await getProduct(offer.product.shopId, offer.product.externalId);
        if (!fresh || fresh.price > Number(offer.price) * PRICE_TOLERANCE) {
          await prisma.offer.update({
            where: { id: offer.id },
            data: { status: "expired", rejectReason: fresh ? `Preço subiu para R$ ${fresh.price.toFixed(2)}` : "Oferta indisponível" },
          });
          log(`[envio] oferta ${offer.id} cancelada (preço mudou ou indisponível)`);
          continue;
        }
      } catch (e) {
        log(`[envio] não deu para reverificar ${offer.id}: ${(e as Error).message} — enviando mesmo assim`);
      }
    }

    // Shopee antiga sem preço antigo salvo: reconstrói a partir do desconto da loja
    if (offer.product.source === "shopee" && offer.originalPrice == null && Number(offer.realDiscountPct ?? 0) >= 5) {
      const op = Math.round((Number(offer.price) / (1 - Number(offer.realDiscountPct) / 100)) * 100) / 100;
      await prisma.offer.update({ where: { id: offer.id }, data: { originalPrice: op } });
      offer.originalPrice = op as unknown as typeof offer.originalPrice;
    }
    const text = await finalMessage(offer, offer.product.source);

    // imagem montada uma vez por oferta (quadrada, alta resolução, selo de desconto)
    let media: string | null = null;
    if (offer.product.imageUrl) {
      try {
        media = (await buildOfferCard(offer.product.imageUrl, offer.realDiscountPct)).toString("base64");
      } catch (e) {
        log(`[envio] não deu para montar a imagem (${(e as Error).message}) — usando a foto original`);
        media = hiResImageUrl(offer.product.imageUrl);
      }
    }
    for (const g of groups) {
      const send = await prisma.send.upsert({
        where: { offerId_groupId: { offerId: offer.id, groupId: g.id } },
        create: { offerId: offer.id, groupId: g.id },
        update: {},
      });
      if (send.status === "sent") continue;
      try {
        if (live) {
          if (media) await sendImage(g.jid!, media, text);
          else await sendText(g.jid!, text);
        } else {
          log(`[simulação] ${g.name}:\n${text}`);
        }
        await prisma.send.update({
          where: { id: send.id },
          data: { status: "sent", sentAt: new Date(), error: live ? null : "simulação (SENDING_ENABLED=false)" },
        });
      } catch (e) {
        await prisma.send.update({ where: { id: send.id }, data: { status: "failed", error: (e as Error).message } });
        log(`[envio] falha no grupo ${g.name}: ${(e as Error).message}`);
      }
      await sleep(8000 + Math.random() * 7000); // 8–15s entre grupos
    }
    await prisma.offer.update({ where: { id: offer.id }, data: { status: "sent", sentAt: new Date() } });
    log(`[envio] oferta ${offer.id} enviada para ${groups.length} grupo(s)`);
  }
}

/** Atualiza a contagem de membros dos grupos (usada pelo redirecionador /grupo) */
export async function syncGroupSizes(log: (m: string) => void = console.log) {
  const evo = await fetchGroups();
  for (const eg of evo) {
    if (typeof eg.size !== "number") continue;
    await prisma.group.updateMany({ where: { jid: eg.id }, data: { memberCount: eg.size } });
  }
  log(`[grupos] contagem atualizada (${evo.length} grupos na Evolution)`);
}
