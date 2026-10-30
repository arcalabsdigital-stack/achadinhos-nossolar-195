// Next.js chama register() uma vez quando o servidor sobe.
// Por padrão, o agendador roda dentro do próprio serviço web (não precisa de worker separado).
// O import fica dentro do "if" do runtime Node para não entrar no bundle Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.WORKER_IN_WEB !== "false") {
      const { startScheduler } = await import("./worker/schedule");
      startScheduler("web");
    }
  }
}
