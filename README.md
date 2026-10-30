# Achadinhos Nosso Lar 🏠

Sistema de ofertas da Shopee para os grupos de WhatsApp do @nossolar195.

**Fluxo do dia:** às 05:30 o coletor busca ofertas, filtra o "desconto falso" e o Claude escreve as mensagens. Às 07:00 o lote está no painel. Você aprova as ofertas e elas entram nos horários do dia. Antes de cada envio o preço é conferido de novo, e a mensagem vai para todos os grupos pela Evolution API.

## Estrutura

| Pasta | O que faz |
|---|---|
| `src/app/aprovacao` | Painel de aprovação em lote + agenda do dia |
| `src/app/grupos` | Cadastro dos grupos (#1, #2…) e vínculo com a Evolution |
| `src/app/nova-oferta` | **Oferta por link**: Amazon (tag aplicada sozinha) e links de afiliado da Shopee sem API |
| `src/app/config` | Horários, palavras-chave, regra de tom, filtros |
| `src/app/grupo` | **Redirecionador público** `/grupo` → primeiro grupo com vaga |
| `src/app/o/[id]` | Link curto rastreável de cada oferta |
| `src/lib/shopee.ts` | Cliente da Open API de afiliados (GraphQL + assinatura SHA256) |
| `src/lib/collector.ts` | Coleta, histórico de preço, filtros e geração do lote |
| `src/lib/claude.ts` | Nota de aderência ao nicho + texto (tom animado/curador) |
| `src/lib/sender.ts` | Reverificação de preço e envio aos grupos |
| `src/worker/schedule.ts` | Agendamentos (coleta 05:30, envio a cada minuto, membros de hora em hora). **Rodam dentro do serviço web** via `src/instrumentation.ts` — não é preciso um worker separado |
| `src/app/whatsapp` | Conecta o WhatsApp na Evolution e mostra o QR Code no painel |

## Deploy no Railway

Crie **um projeto** com 5 serviços:

1. **Postgres:** em New → Database → PostgreSQL.
2. **Redis:** em New → Database → Redis (usado pela Evolution).
3. **Evolution API:** em New → Template, busque "Evolution API". Depois de subir, crie uma instância chamada `achadinhos` e leia o QR Code com o WhatsApp Business do grupo.
4. **web:** em New → GitHub Repo → este repositório.
   - Start command: `npm run start`
   - Gere um domínio público em Settings → Networking.
5. **worker:** em New → GitHub Repo → este mesmo repositório.
   - Start command: `npm run worker`
   - Não precisa de domínio.

Nos serviços **web** e **worker**, configure as variáveis (modelo em `.env.example`):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://<domínio-do-web>
PANEL_PASSWORD=<senha forte>
SHOPEE_APP_ID=...
SHOPEE_APP_SECRET=...
ANTHROPIC_API_KEY=...
EVOLUTION_URL=https://<domínio-da-evolution>
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=achadinhos
SENDING_ENABLED=false
```

O banco é criado sozinho na primeira subida do serviço web, via `prisma db push`.

## Primeiros passos depois do deploy

1. Abra o painel (`https://<domínio>/`). O usuário é `admin` e a senha é a definida em `PANEL_PASSWORD`.
2. Em **Grupos**, cadastre o "Achadinhos Nosso Lar #1" com o link de convite e vincule o grupo da Evolution.
3. Em **Aprovação**, toque em **Gerar lote agora** para testar a coleta.
4. Aprove algumas ofertas. Com `SENDING_ENABLED=false`, o envio só aparece no log do worker (**simulação**).
5. Se o texto e os horários estiverem certos, mude para `SENDING_ENABLED=true`.
6. Troque o link da bio para `https://<domínio>/grupo`.

## Ofertas por link (Amazon e Shopee manual)

Em **➕ Oferta**, cole o link do produto:
- **Amazon:** qualquer link (amzn.to, página do produto). O sistema extrai o código do produto (ASIN) e monta o link com `AMAZON_TAG` (padrão `nossolar195-20`). As mensagens da Amazon usam o **link direto da Amazon**, porque as regras do programa de Associados não permitem esconder o destino atrás de um redirecionador.
- **Shopee sem API:** cole o link de afiliado gerado em "Link personalizado" no painel da Shopee.

O sistema tenta ler o nome, o preço e a imagem da página. Se a loja bloquear a leitura, o formulário pede para preencher à mão. O texto da mensagem é escrito pela IA: **Gemini** (`GEMINI_API_KEY`, que tem plano gratuito) ou Claude (`ANTHROPIC_API_KEY`). Sem nenhuma chave, ou se a IA falhar, entra um modelo padrão. A oferta entra no lote do dia como pendente, para aprovação.

## Regras importantes

- **Desconto real:** nos primeiros 7 dias de histórico vale o desconto informado pela Shopee. Depois disso, o sistema compara com os preços dos últimos 30 dias e só aceita ofertas perto do menor preço do período.
- **Tom:** até R$ 80 o texto é animado; acima disso, curador. O valor é configurável.
- **Reenvio:** o mesmo produto não volta antes de 14 dias.
- **Intervalo:** entre um grupo e outro há uma pausa de 8 a 15 segundos, para reduzir o risco de ban.

## Pendências conhecidas

- Os nomes dos campos da API da Shopee seguem a documentação pública da `productOfferV2`. Se algum campo mudar, o primeiro "Gerar lote agora" mostra o erro no log.
- Ainda não há métricas de comissão (relatório de conversões da Shopee). Isso fica para a etapa 8.
