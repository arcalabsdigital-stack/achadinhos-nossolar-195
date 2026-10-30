"use server";

import { revalidatePath } from "next/cache";
import { logoutInstance } from "@/lib/evolution";

export async function disconnect() {
  await logoutInstance();
  revalidatePath("/whatsapp");
}
