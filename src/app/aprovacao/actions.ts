"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { batchDateValue } from "@/lib/time";
import { fillQueue } from "@/lib/queue";
import { collect } from "@/lib/collector";

/** Aprova as ofertas marcadas e coloca na fila (ocupam os próximos horários livres, hoje ou amanhã) */
export async function approveSelected(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  // links meli.la colados nas ofertas do lote do ML (mesmo nas não marcadas)
  for (const [k, v] of formData.entries()) {
    const link = String(v).trim();
    if (k.startsWith("link_") && /^https?:\/\/\S+$/.test(link)) {
      await prisma.offer.updateMany({ where: { id: k.slice(5), status: "pending" }, data: { affiliateLink: link } });
    }
  }
  if (!ids.length) return revalidatePath("/aprovacao");
  let noLink = 0;
  // mantém a ordem da tela (melhor nota primeiro): cada update tem um updatedAt maior
  for (const id of ids) {
    const message = String(formData.get(`msg_${id}`) ?? "").trim();
    const r = await prisma.offer.updateMany({
      where: { id, status: "pending", affiliateLink: { not: "" } },
      data: { status: "approved", ...(message ? { message } : {}) },
    });
    if (!r.count) noLink++;
  }
  await fillQueue();
  revalidatePath("/aprovacao");
  if (noLink) redirect(`/aprovacao?coleta=${encodeURIComponent(`⚠️ ${noLink} oferta(s) sem link de afiliado ficaram pendentes. Gere o 🔗 link e aprove de novo.`)}`);
}

export async function rejectOne(id: string, formData: FormData) {
  const reason = String(formData.get(`reason_${id}`) ?? "") || null;
  await prisma.offer.updateMany({ where: { id }, data: { status: "rejected", rejectReason: reason } });
  revalidatePath("/aprovacao");
}

export async function rejectRemaining() {
  await prisma.offer.updateMany({
    where: { batchDate: batchDateValue(), status: "pending" },
    data: { status: "rejected", rejectReason: "Sobrou no lote" },
  });
  revalidatePath("/aprovacao");
}

export async function unschedule(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.offer.updateMany({
    where: { id, status: { in: ["scheduled", "approved"] } },
    data: { status: "pending", slotAt: null },
  });
  await fillQueue(); // outra oferta da fila ocupa o horário liberado
  revalidatePath("/aprovacao");
}

export async function runCollectNow() {
  let msg: string;
  try {
    const r = await collect();
    if (r.note) msg = `⚠️ ${r.note}`;
    else if (r.created) msg = `✅ ${r.created} oferta(s) da Shopee geradas (${r.seen} produtos analisados).`;
    else if (r.errors.length) msg = `❌ Erro na Shopee: ${r.errors[0]}`;
    else msg = `ℹ️ ${r.seen} produtos analisados, ${r.candidates} passaram nos filtros, nenhuma oferta nova. Afrouxe os filtros em Configurações (desconto mínimo, nota mínima) ou troque as palavras-chave.`;
  } catch (e) {
    msg = `❌ ${(e as Error).message}`;
  }
  revalidatePath("/aprovacao");
  redirect(`/aprovacao?coleta=${encodeURIComponent(msg.slice(0, 400))}`);
}
