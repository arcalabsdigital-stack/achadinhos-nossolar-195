"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { batchDateValue, slotToDate, todaySP } from "@/lib/time";
import { collect } from "@/lib/collector";

/** Aprova as ofertas marcadas e distribui nos próximos horários livres de hoje */
export async function approveSelected(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  const s = await getSettings();
  const day = todaySP();
  const now = new Date();

  const taken = await prisma.offer.findMany({
    where: { batchDate: batchDateValue(day), status: { in: ["scheduled", "sent"] } },
    select: { slotAt: true },
  });
  const takenTimes = new Set(taken.map((t) => t.slotAt?.getTime()));
  const free = s.slots
    .map((hhmm) => slotToDate(day, hhmm))
    .filter((d) => d.getTime() > now.getTime() && !takenTimes.has(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  // mantém a ordem da tela (melhor nota primeiro)
  for (const [i, id] of ids.entries()) {
    const slot = free[i];
    const message = String(formData.get(`msg_${id}`) ?? "").trim();
    await prisma.offer.updateMany({
      where: { id, status: "pending" },
      data: slot
        ? { status: "scheduled", slotAt: slot, ...(message ? { message } : {}) }
        : { status: "approved", ...(message ? { message } : {}) }, // sem horário livre: fica aprovada, sem agenda
    });
  }
  revalidatePath("/aprovacao");
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
  await prisma.offer.updateMany({ where: { id, status: "scheduled" }, data: { status: "pending", slotAt: null } });
  revalidatePath("/aprovacao");
}

export async function runCollectNow() {
  await collect();
  revalidatePath("/aprovacao");
}
