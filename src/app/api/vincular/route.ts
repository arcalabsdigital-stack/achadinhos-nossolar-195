import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** O ➕ Achadinhos chama esta rota quando o produto foi aberto pelo "🔗 gerar link" da aprovação */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const offer = u.searchParams.get("offer") ?? "";
  const link = (u.searchParams.get("link") ?? "").trim();
  let msg = "❌ Link inválido.";
  if (offer && /^https:\/\/meli\.la\/[A-Za-z0-9]+$/.test(link)) {
    const r = await prisma.offer.updateMany({ where: { id: offer }, data: { affiliateLink: link } });
    msg = r.count ? `✅ Link ${link} adicionado à oferta. Agora é só aprovar.` : "❌ Oferta não encontrada.";
  }
  revalidatePath("/aprovacao");
  const base = process.env.APP_URL || u.origin;
  return NextResponse.redirect(`${base}/aprovacao?coleta=${encodeURIComponent(msg)}#${offer}`, 303);
}
