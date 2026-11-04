import crypto from "node:crypto";

export type LinkSource = "amazon" | "shopee" | "manual";

const AMAZON_HOSTS = ["amazon.com.br", "amzn.to", "a.co", "link.amazon"];
const SHOPEE_HOSTS = ["shopee.com.br", "shp.ee", "s.shopee.com.br"];
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const matches = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));

export function detectSource(url: string): LinkSource {
  const host = hostOf(url);
  if (matches(host, AMAZON_HOSTS)) return "amazon";
  if (matches(host, SHOPEE_HOSTS)) return "shopee";
  return "manual";
}

/** Segue redirecionamentos (amzn.to, shp.ee…) até a URL final, sem baixar a página */
export async function resolveUrl(url: string, maxHops = 5): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5_000),
      });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).toString();
        continue;
      }
    } catch {
      /* sem rede ou bloqueado: fica com a última URL conhecida */
    }
    break;
  }
  return current;
}

export function amazonAsin(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

export function amazonTag() {
  return process.env.AMAZON_TAG || "nossolar195-20";
}

/** Link canônico da Amazon com a tag de Associado */
export function amazonAffiliateLink(asin: string) {
  return `https://www.amazon.com.br/dp/${asin}?tag=${amazonTag()}`;
}

/** ID estável a partir de um link. `full` = considera o link inteiro (inclusive ?parâmetros) */
export function hashId(url: string, full = false) {
  return crypto.createHash("sha1").update(full ? url.trim() : url.split("?")[0]).digest("hex").slice(0, 16);
}

export type PageMeta = { title?: string; price?: number; originalPrice?: number; imageUrl?: string };

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export function parseBRL(v: string | undefined | null): number | undefined {
  if (!v) return undefined;
  const clean = v.replace(/[^\d,.]/g, "");
  if (!clean) return undefined;
  // "1.299,90" → 1299.90 ; "49,90" → 49.90 ; "49.90" → 49.90
  const n = clean.includes(",") ? Number(clean.replace(/\./g, "").replace(",", ".")) : Number(clean);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Tenta ler título, preço e imagem da página do produto.
 * É "melhor esforço": Amazon e Shopee às vezes bloqueiam robôs — nesse caso
 * o formulário pede para preencher à mão.
 */
export async function fetchMeta(url: string): Promise<PageMeta> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return {};
    const html = await res.text();
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];

    const title =
      html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? meta("og:title") ?? meta("title");
    const imageUrl =
      html.match(/data-old-hires=["']([^"']+)["']/i)?.[1] ??
      html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i)?.[1] ??
      meta("og:image");
    // Mercado Livre: preços em aria-label ("Agora: 177 reais com 50 centavos" / "Antes: 299 reais")
    const ml = (label: string) => {
      const m = html.match(new RegExp(`aria-label=["']${label}:\\s*([\\d.]+)\\s*reais(?:\\s*com\\s*(\\d+)\\s*centavos)?`, "i"));
      return m ? Number(m[1].replace(/\./g, "")) + (m[2] ? Number(m[2]) / 100 : 0) : undefined;
    };
    const mlPrice = ml("Agora");
    const mlOld = ml("Antes");
    if (mlPrice) {
      const t = html.match(/class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([^<]+)</i)?.[1] ?? meta("og:title");
      return {
        title: t ? decode(t).replace(/\s*\|\s*Mercado Livre.*$/i, "") : undefined,
        imageUrl: meta("og:image") ? decode(meta("og:image")!) : undefined,
        price: mlPrice,
        originalPrice: mlOld && mlOld > mlPrice ? mlOld : undefined,
      };
    }
    const offscreen = [...html.matchAll(/class=["']a-offscreen["'][^>]*>\s*([^<]+)</gi)].map((m) => parseBRL(m[1]));
    const price = offscreen.find(Boolean) ?? parseBRL(meta("product:price:amount") ?? meta("og:price:amount"));
    const strike =
      html.match(/data-a-strike=["']true["'][\s\S]{0,200}?a-offscreen["'][^>]*>\s*([^<]+)</i)?.[1] ??
      html.match(/class=["']a-price a-text-price["'][\s\S]*?a-offscreen["'][^>]*>\s*([^<]+)</i)?.[1];
    const originalPrice = parseBRL(strike);

    return {
      title: title ? decode(title).replace(/\s*[|:-]\s*Amazon\.com\.br.*$/i, "") : undefined,
      imageUrl: imageUrl ? decode(imageUrl) : undefined,
      price,
      originalPrice: originalPrice && price && originalPrice > price ? originalPrice : undefined,
    };
  } catch {
    return {};
  }
}
