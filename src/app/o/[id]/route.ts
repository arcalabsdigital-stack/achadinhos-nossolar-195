import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Link curto rastreável: /o/<id> → link de afiliado da Shopee
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findFirst({ where: { OR: [{ code: id }, { id }] }, select: { id: true, affiliateLink: true } });
  if (!offer) return new Response("Oferta não encontrada", { status: 404 });
  await prisma.click
    .create({ data: { offerId: offer.id, userAgent: req.headers.get("user-agent")?.slice(0, 200) } })
    .catch(() => {});
  return Response.redirect(offer.affiliateLink, 302);
}
