import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { importMlList, type MlItem } from "@/lib/ml-import";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let msg: string;
  try {
    const items = (await req.json()) as MlItem[];
    const r = await importMlList(Array.isArray(items) ? items.slice(0, 120) : []);
    console.log(`[importar-ml] ${r.seen} lidos, ${r.candidates} candidatos, ${r.created} criados`, r.errors.slice(0, 3));
    if (r.created) msg = `✅ ${r.created} oferta(s) do Mercado Livre no lote (${r.seen} produtos lidos). Gere o link 🔗 das que você escolher.`;
    else if (!r.seen) msg = "⚠️ Não consegui ler produtos dessa página.";
    else if (r.errors.length) msg = `❌ ${r.errors[0]}`;
    else msg = `ℹ️ ${r.seen} produtos lidos, ${r.candidates} passaram nos filtros, nenhuma oferta nova (repetidas ou nota baixa).`;
  } catch (e) {
    msg = `❌ ${(e as Error).message}`;
  }
  revalidatePath("/aprovacao");
  return NextResponse.json({ msg });
}
