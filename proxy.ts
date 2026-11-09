import { NextResponse, type NextRequest } from "next/server";

/**
 * Protège le tableau de bord par un mot de passe (variable MOT_DE_PASSE_SITE dans Vercel).
 * Le navigateur affiche une petite fenêtre de connexion : n'importe quel identifiant, et ce mot de passe.
 * La route /api/check n'est pas concernée : elle a sa propre protection (CRON_SECRET).
 */
export function proxy(req: NextRequest) {
  const motDePasse = process.env.MOT_DE_PASSE_SITE;
  if (!motDePasse) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    const decode = atob(auth.slice(6));
    const mdp = decode.slice(decode.indexOf(":") + 1);
    if (mdp === motDePasse) return NextResponse.next();
  }
  return new NextResponse("Accès protégé", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Robot d\'alertes", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/check|_next/static|_next/image|favicon.ico).*)"],
};
