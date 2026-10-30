// Brasil (America/Sao_Paulo) está em UTC-3 fixo desde 2019 (sem horário de verão).
const OFFSET_HOURS = 3;

/** Data de hoje em São Paulo no formato YYYY-MM-DD */
export function todaySP(now = new Date()): string {
  const sp = new Date(now.getTime() - OFFSET_HOURS * 3600_000);
  return sp.toISOString().slice(0, 10);
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
