import cron from "node-cron";
import { collect } from "../lib/collector";
import { processDueOffers, syncGroupSizes } from "../lib/sender";

const TZ = { timezone: "America/Sao_Paulo" };
const g = globalThis as unknown as { __achadinhosScheduler?: boolean };

const safe = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    console.error(`[${name}]`, (e as Error).message);
  }
};

/** Inicia os agendamentos (uma única vez por processo) */
export function startScheduler(origin: string) {
  if (g.__achadinhosScheduler) return;
  g.__achadinhosScheduler = true;
  let sending = false;

  // 05:30 — monta o lote do dia da Shopee (fica pronto antes das 07:00)
  cron.schedule("30 5 * * *", safe("coletor", () => collect()), TZ);

  // A cada minuto — envia ofertas agendadas que chegaram no horário
  cron.schedule(
    "* * * * *",
    safe("envio", async () => {
      if (sending) return;
      sending = true;
      try {
        await processDueOffers();
      } finally {
        sending = false;
      }
    }),
  );

  // De hora em hora — atualiza número de membros dos grupos
  cron.schedule(
    "7 * * * *",
    safe("grupos", async () => {
      if (process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY) await syncGroupSizes();
    }),
  );

  console.log(
    `[agendador] no ar (${origin}) — envio ${process.env.SENDING_ENABLED === "true" ? "REAL" : "em SIMULAÇÃO"}`,
  );
}
