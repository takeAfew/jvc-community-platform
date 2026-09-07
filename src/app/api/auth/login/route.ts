import { NextResponse } from "next/server";
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  AUTH_COOKIE_NAME,
  createSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username || "").trim();
    const password = (body.password || "").trim();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = await createSessionToken(ADMIN_USERNAME);

      const response = NextResponse.json({
        success: true,
        message: "Autenticazione riuscita",
      });

      // Imposta il cookie di sessione protetto
      response.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 14 * 24 * 60 * 60, // 14 giorni
      });

      return response;
    }

    return NextResponse.json(
      {
        success: false,
        error: "Credenziali non valide. Verifica Username e Password.",
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Errore durante l'autenticazione",
      },
      { status: 500 }
    );
  }
}
