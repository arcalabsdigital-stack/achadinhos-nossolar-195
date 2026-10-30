"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_VOICE } from "@/lib/claude";

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveSettings(formData: FormData) {
  // ordena pelo dia de operação (05:00 → 04:59): 00:30 vem depois de 23:30
  const key = (t: string) => (Number(t.slice(0, 2)) < 5 ? 24 : 0) * 60 + Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots = [...new Set(list(formData.get("slots")).filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)))].sort(
    (a, b) => key(a) - key(b),
  );
  await prisma.settings.update({
    where: { id: "main" },
    data: {
      slots,
      batchSize: Number(formData.get("batchSize")),
      toneThreshold: Number(formData.get("toneThreshold")),
      minRealDiscount: Number(formData.get("minRealDiscount")),
      minRating: Number(formData.get("minRating")),
      keywords: list(formData.get("keywords")),
      blockedWords: list(formData.get("blockedWords")),
      // igual ao padrão → guarda vazio, para receber melhorias futuras do padrão
      voiceNotes: (() => {
        const v = String(formData.get("voiceNotes") ?? "").replace(/\r\n/g, "\n").trim();
        return v === DEFAULT_VOICE.trim() ? "" : v;
      })(),
    },
  });
  revalidatePath("/config");
}
