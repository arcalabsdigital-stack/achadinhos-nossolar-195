import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Redirecionador: manda a pessoa para o primeiro grupo ativo que ainda tem vaga
export async function GET() {
  const groups = await prisma.group.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  const open = groups.find((g) => g.memberCount < g.capacity) ?? groups.at(-1);
  if (!open) return new Response("Nenhum grupo disponível no momento", { status: 503 });
  return Response.redirect(open.inviteLink, 302);
}
