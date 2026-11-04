import { prisma } from "@/lib/db";
import { buildOfferCard } from "@/lib/card";

export const dynamic = "force-dynamic";

// Prévia da imagem que vai para o WhatsApp (usada no painel)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, include: { product: true } });
  if (!offer?.product.imageUrl) return new Response("sem imagem", { status: 404 });
  try {
    const jpg = await buildOfferCard(offer.product.imageUrl, offer.realDiscountPct);
    return new Response(new Uint8Array(jpg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return Response.redirect(offer.product.imageUrl, 302);
  }
}
