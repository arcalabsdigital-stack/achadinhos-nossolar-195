import { prisma } from "./db";
import { getSettings } from "./settings";
import { batchDateValue, slotToDate, todaySP } from "./time";

const MAX_DAYS_IN_QUEUE = 2; // aprovada há mais de 2 dias sem sair → expira (preço pode ter mudado)

function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fila: distribui as ofertas aprovadas (sem horário) nos próximos horários livres
 * de hoje e de amanhã, na ordem em que foram aprovadas.
 */
export async function fillQueue() {
  const now = new Date();
  const day = todaySP(now);

  // ofertas esquecidas na fila há muito tempo expiram
  const limit = batchDateValue(day);
  limit.setUTCDate(limit.getUTCDate() - MAX_DAYS_IN_QUEUE);
  await prisma.offer.updateMany({
    where: { status: "approved", batchDate: { lt: limit } },
    data: { status: "expired", rejectReason: "Ficou muito tempo na fila sem horário" },
  });

  const waiting = await prisma.offer.findMany({
    where: { status: "approved", affiliateLink: { not: "" } },
    orderBy: [{ updatedAt: "asc" }, { score: "desc" }],
    select: { id: true },
  });
  if (!waiting.length) return 0;

  const s = await getSettings();
  const taken = await prisma.offer.findMany({
    where: { status: { in: ["scheduled", "sent"] }, slotAt: { gte: new Date(now.getTime() - 3600_000) } },
    select: { slotAt: true },
  });
  const takenTimes = new Set(taken.map((t) => t.slotAt!.getTime()));
  const minStart = now.getTime() + 60_000; // pelo menos 1 minuto à frente
  const free = [day, nextDay(day)]
    .flatMap((d) => s.slots.map((hhmm) => slotToDate(d, hhmm)))
    .filter((d) => d.getTime() > minStart && !takenTimes.has(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  let n = 0;
  for (const [i, o] of waiting.entries()) {
    const slot = free[i];
    if (!slot) break;
    const r = await prisma.offer.updateMany({
      where: { id: o.id, status: "approved" },
      data: { status: "scheduled", slotAt: slot },
    });
    n += r.count;
  }
  return n;
}
