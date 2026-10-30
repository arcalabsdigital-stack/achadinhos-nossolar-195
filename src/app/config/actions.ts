"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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
    },
  });
  revalidatePath("/config");
}
