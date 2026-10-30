// Worker separado (opcional). Se usar este serviço, defina WORKER_IN_WEB=false no serviço web
// para não disparar as mensagens em dobro.
import { startScheduler } from "./schedule";

startScheduler("worker");
