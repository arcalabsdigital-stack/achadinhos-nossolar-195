// Brasil (America/Sao_Paulo) está em UTC-3 fixo desde 2019 (sem horário de verão).
const OFFSET_HOURS = 3;

/**
 * O "dia de operação" vai das 05:00 às 04:59 do dia seguinte (horário de SP).
 * Assim, horários de madrugada (00:00, 00:30, 01:00…) pertencem ao lote da noite anterior.
 */
export const DAY_START_HOUR = 5;

/** Dia de operação atual em São Paulo (YYYY-MM-DD) */
export function todaySP(now = new Date()): string {
  const sp = new Date(now.getTime() - (OFFSET_HOURS + DAY_START_HOUR) * 3600_000);
  return sp.toISOString().slice(0, 10);
}

/** Horário de envio (HH:MM) do dia de operação → Date UTC; madrugada cai no dia seguinte */
export function slotToDate(day: string, hhmm: string): Date {
  const d = spToDate(day, hhmm);
  if (Number(hhmm.split(":")[0]) < DAY_START_HOUR) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Converte "YYYY-MM-DD" + "HH:MM" (horário de SP) em Date UTC */
export function spToDate(day: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCHours(h + OFFSET_HOURS, m, 0, 0);
  return d;
}

/** Formata Date como HH:MM em SP */
export function hhmmSP(d: Date): string {
  const sp = new Date(d.getTime() - OFFSET_HOURS * 3600_000);
  return sp.toISOString().slice(11, 16);
}

export function batchDateValue(day = todaySP()): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
