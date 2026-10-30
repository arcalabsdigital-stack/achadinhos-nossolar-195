// Next.js chama register() uma vez quando o servidor sobe.
// Por padrão, o agendador roda dentro do próprio serviço web (não precisa de worker separado).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.WORKER_IN_WEB === "false") return;
  const { startScheduler } = await import("./worker/schedule");
  startScheduler("web");
}
