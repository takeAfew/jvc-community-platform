import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Percorsi pubblici sempre accessibili
  const isPublicApi =
    pathname === "/api/auth/login" ||
    pathname === "/api/apply" ||
    pathname.startsWith("/api/cron");

  const isLoginPage = pathname === "/login";

  // Se l'utente visita /login mentre è già autenticato, reindirizzalo alla dashboard
  if (isLoginPage) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);
    if (isValid) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Lascia passare le API pubbliche
  if (isPublicApi) {
    return NextResponse.next();
  }

  // Verifica del token di sessione per tutte le altre pagine e API protette
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    // Se è una richiesta API (es. /api/admin/..., /api/whatsapp/...) rispondi con 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Accesso non autorizzato. Effettua il login." },
        { status: 401 }
      );
    }

    // Se è navigazione di pagina (es. /), reindirizza alla pagina di login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Intercetta tutte le rotte eccetto:
     * - _next/static (file statici generati da Next)
     * - _next/image (ottimizzazione immagini Next)
     * - favicon.ico e file multimediali statici
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
