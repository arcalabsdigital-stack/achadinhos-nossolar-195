// Roda o coletor manualmente: npm run collect
import { collect } from "../lib/collector";
import { prisma } from "../lib/db";

collect()
  .then((n) => console.log(`ok: ${n.created} ofertas`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
