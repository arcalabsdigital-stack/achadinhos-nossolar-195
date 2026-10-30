import { NextResponse, type NextRequest } from "next/server";

// Painel protegido por senha (usuário: admin). Rotas públicas: /grupo, /o/*, /api/health
export function middleware(req: NextRequest) {
  const pass = process.env.PANEL_PASSWORD;
  if (!pass) return new NextResponse("Defina PANEL_PASSWORD", { status: 500 });
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pwd] = atob(encoded).split(":");
    if (user === "admin" && pwd === pass) return NextResponse.next();
  }
  return new NextResponse("Acesso restrito", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Achadinhos", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!grupo$|o/|api/health|_next/|favicon).*)"],
};
