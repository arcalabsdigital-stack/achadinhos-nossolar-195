import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const SIZE = 1080; // quadrado: o WhatsApp mostra a imagem inteira, sem cortar
const PAD = 70;

/** Troca a URL da foto pela versão em alta resolução (Amazon / Mercado Livre) */
export function hiResImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/media-amazon\.com$|images-amazon\.com$|ssl-images-amazon\.com$/.test(u.hostname)) {
      // ..._AC_SX300_SY300_QL70_.jpg → ..._AC_SL1500_.jpg
      u.pathname = u.pathname.replace(/\._[^/]*_\.(jpe?g|png|webp)$/i, "._AC_SL1500_.$1");
      return u.toString();
    }
    if (/mlstatic\.com$/.test(u.hostname)) {
      // D_NQ_NP_123-MLA456-V.webp (miniatura) → -O.jpg (original)
      u.pathname = u.pathname.replace(/-[A-Z]\.(webp|jpe?g|png)$/i, "-O.jpg");
      return u.toString();
    }
  } catch {
    /* URL inválida: devolve como veio */
  }
  return url;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`imagem ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const FONT_FILE = path.join(process.cwd(), "node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

/** Selo vermelho "-47%". Fonte embutida no projeto (o servidor não tem fontes instaladas). */
async function badge(pct: number): Promise<Buffer | null> {
  try {
    const label = await sharp({
      text: { text: `<span foreground="#ffffff">-${pct}%</span>`, font: "DejaVu Sans Bold", fontfile: FONT_FILE, rgba: true, dpi: 300 },
    })
      .resize({ height: 58 })
      .png()
      .toBuffer();
    const { width = 120 } = await sharp(label).metadata();
    const w = width + 64;
    const pill = Buffer.from(`<svg width="${w}" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="100" rx="50" fill="#e53935"/></svg>`);
    return await sharp(pill).composite([{ input: label, gravity: "center" }]).png().toBuffer();
  } catch {
    return null; // sem selo se a fonte não carregar
  }
}

/**
 * Monta a imagem da oferta: foto em alta, centralizada num quadrado branco 1080×1080,
 * com selo de desconto quando for ≥ 10%. Retorna JPEG em base64.
 */
export async function buildOfferCard(imageUrl: string, discountPct?: number | null): Promise<Buffer> {
  let raw: Buffer;
  try {
    raw = await download(hiResImageUrl(imageUrl));
  } catch {
    raw = await download(imageUrl); // se a versão em alta não existir, usa a original
  }
  const product = await sharp(raw)
    .flatten({ background: "#ffffff" })
    .resize(SIZE - PAD * 2, SIZE - PAD * 2, { fit: "inside", withoutEnlargement: false, kernel: "lanczos3" })
    .toBuffer();

  const layers: OverlayOptions[] = [{ input: product, gravity: "center" }];
  const pct = discountPct ? Math.round(discountPct) : 0;
  if (pct >= 10) {
    const b = await badge(pct);
    if (b) layers.push({ input: b, top: 36, left: 36 });
  }

  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" } })
    .composite(layers)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
