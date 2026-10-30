import { prisma } from "@/lib/db";
import { fetchGroups, type EvoGroup } from "@/lib/evolution";
import { addGroup, syncNow, updateGroup } from "./actions";

export const dynamic = "force-dynamic";

export default async function Grupos() {
  const groups = await prisma.group.findMany({ orderBy: { order: "asc" } });
  let evo: EvoGroup[] = [];
  let evoError = "";
  try {
    evo = await fetchGroups();
  } catch (e) {
    evoError = (e as Error).message;
  }
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");

  return (
    <>
      <h1>Grupos</h1>
      <p className="muted">
        Link único para divulgar: <b>{base}/grupo</b> — manda cada pessoa para o primeiro grupo com vaga.
      </p>
      {evoError && <p className="notice">Evolution não conectada: {evoError}</p>}

      {groups.map((g) => (
        <form className="card" action={updateGroup} key={g.id}>
          <input type="hidden" name="id" value={g.id} />
          <div className="title">
            {g.name} · {g.memberCount}/{g.capacity} membros
          </div>
          <div className="field">
            <label>Grupo na Evolution</label>
            <select name="jid" defaultValue={g.jid ?? ""}>
              <option value="">— não vinculado (não recebe envios) —</option>
              {evo.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.subject}
                </option>
              ))}
              {g.jid && !evo.some((e) => e.id === g.jid) && <option value={g.jid}>{g.jid}</option>}
            </select>
          </div>
          <div className="field">
            <label>Link de convite</label>
            <input name="inviteLink" defaultValue={g.inviteLink} />
          </div>
          <div className="flex">
            <div className="field" style={{ flex: 1 }}>
              <label>Capacidade</label>
              <input name="capacity" type="number" defaultValue={g.capacity} />
            </div>
            <label className="pick">
              <input type="checkbox" name="active" defaultChecked={g.active} /> Ativo
            </label>
          </div>
          <button>Salvar</button>
        </form>
      ))}

      <h2>Adicionar grupo</h2>
      <form className="card" action={addGroup}>
        <div className="field">
          <label>Nome</label>
          <input name="name" placeholder={`Achadinhos Nosso Lar #${groups.length + 1}`} required />
        </div>
        <div className="field">
          <label>Link de convite</label>
          <input name="inviteLink" placeholder="https://chat.whatsapp.com/..." required />
        </div>
        <div className="field">
          <label>Grupo na Evolution (opcional agora)</label>
          <select name="jid" defaultValue="">
            <option value="">— vincular depois —</option>
            {evo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.subject}
              </option>
            ))}
          </select>
        </div>
        <button className="primary">Adicionar</button>
      </form>

      <form action={syncNow}>
        <button>🔄 Atualizar contagem de membros</button>
      </form>
    </>
  );
}
