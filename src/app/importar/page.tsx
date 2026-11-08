"use client";

import { useEffect, useState } from "react";

/** Recebe a lista lida pelo ➕ Achadinhos (no #hash da URL) e manda para o servidor */
export default function Importar() {
  const [status, setStatus] = useState("Lendo a lista…");
  useEffect(() => {
    let items: unknown[] = [];
    try {
      items = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    } catch {
      setStatus("❌ Não recebi a lista de produtos. Volte à página do Mercado Livre e clique no ➕ Achadinhos de novo.");
      return;
    }
    history.replaceState(null, "", "/importar");
    setStatus(`⏳ Analisando ${items.length} produtos e escrevendo os textos… (pode levar até 1 minuto)`);
    fetch("/api/importar-ml", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(items) })
      .then((r) => r.json())
      .then((r: { msg: string }) => {
        location.href = `/aprovacao?coleta=${encodeURIComponent(r.msg)}`;
      })
      .catch((e) => setStatus(`❌ ${e}`));
  }, []);
  return (
    <>
      <h1>Importar do Mercado Livre</h1>
      <div className="card">
        <p>{status}</p>
      </div>
    </>
  );
}
