import crypto from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

export type ShopeeProduct = {
  itemId: string;
  shopId: string | null;
  productName: string;
  price: number;
  priceMin: number | null;
  priceMax: number | null;
  priceDiscountRate: number | null;
  commissionRate: number | null;
  imageUrl: string | null;
  productLink: string;
  offerLink: string;
  shopName: string | null;
  ratingStar: number | null;
  sales: number | null;
};

function creds() {
  // trim: espaços/quebras de linha coladas junto no Railway invalidam a assinatura
  const appId = process.env.SHOPEE_APP_ID?.trim().replace(/^["']|["']$/g, "");
  const secret = process.env.SHOPEE_APP_SECRET?.trim().replace(/^["']|["']$/g, "");
  if (!appId || !secret) throw new Error("SHOPEE_APP_ID / SHOPEE_APP_SECRET não configurados");
  return { appId, secret };
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { appId, secret } = creds();
  const payload = JSON.stringify({ query, variables });
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash("sha256").update(`${appId}${ts}${payload}${secret}`).digest("hex");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${signature}`,
    },
    body: payload,
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(`Shopee API: ${json.errors?.map((e) => e.message).join("; ") ?? res.status}`);
  }
  return json.data as T;
}

const NODE_FIELDS = `itemId shopId productName price priceMin priceMax priceDiscountRate
  commissionRate imageUrl productLink offerLink shopName ratingStar sales`;

type RawNode = Record<string, string | number | null>;

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function parse(n: RawNode): ShopeeProduct {
  return {
    itemId: String(n.itemId),
    shopId: n.shopId ? String(n.shopId) : null,
    productName: String(n.productName ?? ""),
    price: Number(n.price ?? n.priceMin ?? 0),
    priceMin: num(n.priceMin),
    priceMax: num(n.priceMax),
    priceDiscountRate: num(n.priceDiscountRate),
    commissionRate: num(n.commissionRate),
    imageUrl: n.imageUrl ? String(n.imageUrl) : null,
    productLink: String(n.productLink ?? ""),
    offerLink: String(n.offerLink ?? n.productLink ?? ""),
    shopName: n.shopName ? String(n.shopName) : null,
    ratingStar: num(n.ratingStar),
    sales: num(n.sales),
  };
}

/** Busca produtos por palavra-chave. sortType: 1 relevância, 2 mais vendidos, 5 maior comissão */
export async function searchProducts(keyword: string, opts: { limit?: number; page?: number; sortType?: number } = {}) {
  const data = await gql<{ productOfferV2: { nodes: RawNode[] } }>(
    `query($keyword: String, $sortType: Int, $page: Int, $limit: Int) {
      productOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
        nodes { ${NODE_FIELDS} }
      }
    }`,
    { keyword, sortType: opts.sortType ?? 2, page: opts.page ?? 1, limit: opts.limit ?? 30 },
  );
  return data.productOfferV2.nodes.map(parse);
}

/** Gera o link curto oficial de afiliado (s.shopee.com.br/…) para qualquer URL da Shopee */
export async function shortLink(originUrl: string): Promise<string> {
  const data = await gql<{ generateShortLink: { shortLink: string } }>(
    `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: ["grupo"] }) { shortLink } }`,
  );
  return data.generateShortLink.shortLink;
}

/** shopId e itemId a partir da URL de produto da Shopee */
export function shopeeIds(url: string): { shopId: string; itemId: string } | null {
  const m = url.match(/-i\.(\d+)\.(\d+)/) ?? url.match(/\/product\/(\d+)\/(\d+)/);
  return m ? { shopId: m[1], itemId: m[2] } : null;
}

/** Preço antigo a partir do % de desconto informado pela Shopee */
export function shopeeOriginalPrice(price: number, rate: number | null) {
  return rate && rate >= 5 && rate < 95 ? Math.round((price / (1 - rate / 100)) * 100) / 100 : null;
}

/** Consulta um item específico (usado para reverificar o preço antes do envio) */
export async function getProduct(shopId: string, itemId: string): Promise<ShopeeProduct | null> {
  if (!/^\d+$/.test(shopId) || !/^\d+$/.test(itemId)) throw new Error("shopId/itemId inválidos");
  // IDs passados inline: a API usa Int64 e o tipo exato da variável varia entre versões.
  const data = await gql<{ productOfferV2: { nodes: RawNode[] } }>(
    `query { productOfferV2(shopId: ${shopId}, itemId: ${itemId}, limit: 1) { nodes { ${NODE_FIELDS} } } }`,
  );
  const n = data.productOfferV2.nodes[0];
  return n ? parse(n) : null;
}
