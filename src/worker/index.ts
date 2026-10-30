import cron from "node-cron";
import { collect } from "../lib/collector";
import { processDueOffers, syncGroupSizes } from "../lib/sender";

const TZ = { timezone: "America/Sao_Paulo" };
let sending = false;

const safe = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    console.error(`[${name}]`, (e as Error).message);
  }
};

// 05:30 — monta o lote do dia (fica pronto antes das 07:00)
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
cron.schedule("7 * * * *", safe("grupos", () => syncGroupSizes()));

console.log(`[worker] no ar — envio ${process.env.SENDING_ENABLED === "true" ? "REAL" : "em SIMULAÇÃO"}`);
