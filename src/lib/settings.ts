import { prisma } from "./db";

export async function getSettings() {
  return prisma.settings.upsert({ where: { id: "main" }, create: { id: "main" }, update: {} });
}
