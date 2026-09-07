export const AUTH_COOKIE_NAME = "jvc_session";
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "JVC";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Psw123@";

const SECRET_KEY =
  process.env.ADMIN_SESSION_SECRET || "jvc-admin-europe-secure-secret-2026";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 giorni

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Genera un token firmato contenente username, timestamp e firma HMAC.
 */
export async function createSessionToken(username: string): Promise<string> {
  const enc = new TextEncoder();
  const timestamp = Date.now().toString();
  const payload = `${username}:${timestamp}`;
  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const signature = bufferToHex(signatureBuffer);
  return `${payload}:${signature}`;
}

/**
 * Verifica l'integrità e la validità temporale del token di sessione.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;

    const [username, timestampStr, signature] = parts;
    if (username !== ADMIN_USERNAME) return false;

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > SESSION_DURATION_MS) {
      return false; // Token scaduto
    }

    const enc = new TextEncoder();
    const payload = `${username}:${timestampStr}`;
    const key = await getHmacKey();
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const expectedSignature = bufferToHex(signatureBuffer);

    return signature === expectedSignature;
  } catch (error) {
    console.error("Errore verifica sessione:", error);
    return false;
  }
}
