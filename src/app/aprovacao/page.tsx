import { prisma } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import { batchDateValue, hhmmSP, slotToDate, todaySP } from "@/lib/time";
import { approveSelected, rejectOne, rejectRemaining, runCollectNow, unschedule } from "./actions";

export const dynamic = "force-dynamic";

const brl = (v: unknown) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const REASONS = ["Fora do nicho", "Marca/qualidade ruim", "Preço não é bom", "Já tem parecido", "Outro"];
const STATUS: Record<string, string> = {
  scheduled: "⏰ agendada",
  sent: "✅ enviada",
  expired: "⚠️ cancelada",
  approved: "⏳ na fila (sem horário livre)",
};

export default async function Aprovacao() {
  const day = todaySP();
  const batchDate = batchDateValue(day);
  const [pending, agenda] = await Promise.all([
    prisma.offer.findMany({
      where: { batchDate, status: "pending" },
      include: { product: true },
      orderBy: { score: "desc" },
    }),
    prisma.offer.findMany({
      where: {
        OR: [
          // tudo o que tem horário a partir do início do dia de operação (hoje e fila de amanhã)
          { status: { in: ["scheduled", "sent", "expired"] }, slotAt: { gte: slotToDate(day, "05:00") } },
          // aprovadas ainda sem horário (fila)
          { status: "approved" },
          // canceladas hoje sem horário
          { status: "expired", slotAt: null, batchDate },
        ],
      },
      include: { product: true, _count: { select: { clicks: true } } },
      orderBy: [{ slotAt: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }],
    }),
  ]);

  return (
    <>
      {/* Atualiza a agenda sozinha — só quando não há lote em edição, para não perder textos alterados */}
      {pending.length === 0 && agenda.some((o) => o.status === "scheduled") && <AutoRefresh seconds={30} />}
      <h1>Lote de hoje</h1>
      <p className="muted">
        {day.split("-").reverse().join("/")} · {pending.length} pendente(s) · marque as que vão para o grupo
      </p>

      {pending.length === 0 && (
        <div className="card">
          <p>Nenhuma oferta pendente.</p>
          <div className="flex">
            <a href="/nova-oferta">
              <button type="button" className="primary">➕ Adicionar por link</button>
            </a>
            <form action={runCollectNow}>
              <button>🔄 Gerar lote da Shopee</button>
            </form>
          </div>
          <p className="muted">O lote automático da Shopee depende da liberação da API.</p>
        </div>
      )}

      {pending.length > 0 && (
        <p>
          <a href="/nova-oferta">➕ Adicionar oferta por link</a>
        </p>
      )}

      {pending.length > 0 && (
        <form action={approveSelected}>
          {pending.map((o) => (
            <div className="card" key={o.id}>
              <div className="row">
                {o.product.imageUrl && <img className="thumb" src={o.product.imageUrl} alt="" />}
                <div>
                  <div className="title">{o.product.title}</div>
                  <div className="chips">
                    <span className="chip">{({ amazon: "Amazon", shopee: "Shopee", manual: "Link" } as Record<string, string>)[o.product.source]}</span>
                    <span className="chip ok">{brl(o.price)}</span>
                    {o.realDiscountPct ? <span className="chip ok">-{Math.round(o.realDiscountPct)}%</span> : null}
                    {o.lowest30d ? <span className="chip">mín. 30d {brl(o.lowest30d)}</span> : null}
                    <span className="chip warn">nota {o.score?.toFixed(1)}</span>
                    <span className="chip">{o.tone === "animado" ? "🔥 animado" : "🧐 curador"}</span>
                    {o.product.rating ? <span className="chip">⭐ {o.product.rating.toFixed(1)}</span> : null}
                  </div>
                  {o.scoreReason && <p className="muted">{o.scoreReason}</p>}
                </div>
              </div>
              <textarea name={`msg_${o.id}`} defaultValue={o.message} />
              <div className="flex" style={{ marginTop: 8 }}>
                <label className="pick" style={{ flex: 1, marginTop: 0 }}>
                  <input type="checkbox" name="ids" value={o.id} /> Aprovar
                </label>
                <select name={`reason_${o.id}`} style={{ width: "auto" }} defaultValue="">
                  <option value="">Motivo…</option>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <button className="danger" formAction={rejectOne.bind(null, o.id)}>
                  ✕
                </button>
              </div>
              <a className="muted" href={o.product.productUrl} target="_blank">
                ver na loja ↗
              </a>
            </div>
          ))}

          <div className="bar">
            <div className="inner">
              <button className="primary">Aprovar marcadas</button>
              <button formAction={rejectRemaining}>Descartar resto</button>
            </div>
          </div>
        </form>
      )}

      <h2>Agenda e fila</h2>
      {agenda.length === 0 ? (
        <p className="muted">Nada agendado ainda.</p>
      ) : (
        <table className="agenda">
          <tbody>
            {agenda.map((o) => (
              <tr key={o.id}>
                <td style={{ width: 64 }}>
                  {o.slotAt ? (
                    <>
                      {o.slotAt.getTime() >= slotToDate(day, "05:00").getTime() + 24 * 3600_000 && (
                        <div className="muted">amanhã</div>
                      )}
                      {hhmmSP(o.slotAt)}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {o.product.title.slice(0, 60)}
                  <div className="muted">
                    {STATUS[o.status]} · {o._count.clicks} clique(s)
                    {o.rejectReason ? ` · ${o.rejectReason}` : ""}
                  </div>
                </td>
                <td style={{ width: 40 }}>
                  {(o.status === "scheduled" || o.status === "approved") && (
                    <form action={unschedule}>
                      <input type="hidden" name="id" value={o.id} />
                      <button title="Voltar para o lote">↩︎</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
