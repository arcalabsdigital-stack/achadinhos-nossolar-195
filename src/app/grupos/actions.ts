"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncGroupSizes } from "@/lib/sender";

export async function addGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const inviteLink = String(formData.get("inviteLink") ?? "").trim().split("?")[0];
  const jid = String(formData.get("jid") ?? "").trim() || null;
  if (!name || !inviteLink) return;
  const count = await prisma.group.count();
  await prisma.group.create({ data: { name, inviteLink, jid, order: count + 1 } });
  revalidatePath("/grupos");
}

export async function updateGroup(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.group.update({
    where: { id },
    data: {
      jid: String(formData.get("jid") ?? "").trim() || null,
      inviteLink: String(formData.get("inviteLink") ?? "").trim().split("?")[0],
      capacity: Number(formData.get("capacity") ?? 1000),
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/grupos");
}

export async function syncNow() {
  await syncGroupSizes();
  revalidatePath("/grupos");
}
