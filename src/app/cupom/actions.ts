"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { batchDateValue } from "@/lib/time";
import { amazonTag, detectSource, hashId } from "@/lib/links";
import { shortLink } from "@/lib/shopee";

const STORES: Record<string, string> = { ml: "Mercado Livre", shopee: "Shopee", amazon: "Amazon" };
const f = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Post de cupom: entra no lote como uma oferta (sem foto, sem IA) e segue a fila de horários */
export async function addCoupon(fd: FormData) {
  const store = f(fd, "store");
  const code = f(fd, "code").toUpperCase().replace(/\s+/g, "");
  const discount = f(fd, "discount");
  const minimum = f(fd, "minimum");
  const validity = f(fd, "validity");
  const note = f(fd, "note");
  let link = f(fd, "link");
  if (!STORES[store] || !discount || !/^https?:\/\//i.test(link)) {
    redirect(`/cupom?erro=${encodeURIComponent("Preencha a loja, o desconto e um link começando com https://")}`);
  }

  const source = detectSource(link);
  // Página da Shopee (não afiliada): gera o link curto de afiliado pela API
  if (source === "shopee" && /(^|\.)shopee\.com\.br\//.test(link.replace(/^https?:\/\//, "")) && process.env.SHOPEE_APP_ID) {
    link = await shortLink(link).catch(() => link);
  }
  if (source === "amazon" && !/[?&]tag=/.test(link)) {
    link += `${link.includes("?") ? "&" : "?"}tag=${amazonTag()}`;
  }

  const name = STORES[store];
  const lines = [
    `🎟️ *CUPOM ${name.toUpperCase()}*`,
    "",
    `*${discount}*${minimum ? ` em compras a partir de ${minimum}` : ""}`,
    code ? `Código: *${code}*` : "Cupom aplicado direto na página (é só ativar)",
    validity ? `⏰ ${validity}` : "⏰ Válido enquanto durar — corre, amigona!",
  ];
  if (note) lines.push("", note);
  lines.push("", code ? "Entra pelo link, coloca no carrinho e aplica o código no pagamento 😉" : "Entra pelo link e ativa o cupom antes de pagar 😉");

  const batchDate = batchDateValue();
  const externalId = `cupom-${hashId(`${store}|${code}|${discount}|${link}`, true)}`;
  const title = `Cupom ${name}: ${discount}${code ? ` (${code})` : ""}`;
  const product = await prisma.product.upsert({
    where: { source_externalId: { source, externalId } },
    create: { source, externalId, title, productUrl: link, category: "cupom" },
    update: { title, productUrl: link },
  });
  const data = {
    price: 0,
    affiliateLink: link,
    coupon: code || discount,
    score: 10,
    scoreReason: "Cupom adicionado por você",
    message: lines.join("\n"),
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
