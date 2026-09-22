/** Verify Razorpay webhook `x-razorpay-signature` (HMAC-SHA256 of raw body, hex digest). */

export async function verifyRazorpayWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const normalized = normalizeHex(signatureHeader);
  const expected = await sha256HexHmac(webhookSecret, rawBody);
  const a = normalized;
  const b = normalizeHex(expected);
  if (a.length !== b.length) return false;
  let xor = 0;
  for (let i = 0; i < a.length; i++) xor |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return xor === 0;
}

function normalizeHex(s: string): string {
  return s.trim().toLowerCase().replace(/^0x/, "");
}

async function sha256HexHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return bufferToHex(new Uint8Array(sig));
}

function bufferToHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
