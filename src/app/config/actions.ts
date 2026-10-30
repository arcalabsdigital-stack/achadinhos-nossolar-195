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
  const slots = list(formData.get("slots")).filter((s) => /^\d{2}:\d{2}$/.test(s)).sort();
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
