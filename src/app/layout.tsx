import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Achadinhos Nosso Lar — Painel" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav>
          <a href="/aprovacao">✅ Aprovação</a>
          <a href="/nova-oferta">➕ Oferta</a>
          <a href="/cacar">🔎 Caçar</a>
          <a href="/whatsapp">📱 WhatsApp</a>
          <a href="/grupos">👥 Grupos</a>
          <a href="/config">⚙️ Configurações</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
