type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Temporary safety net for local development only. Production deployments must
 * provide a shared edge limiter (for example Durable Objects or Upstash) and
 * reject requests before they reach this fallback.
 */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function clientAddress(request: Request): string {
  // Only use headers set by the hosting platform. User-controlled forwarded
  // headers are trivially spoofed and must not be used as an identity key.
  return (
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("true-client-ip")?.trim() ||
    "unknown"
  );
}

export function tooManyRequests(): Response {
  return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
}
