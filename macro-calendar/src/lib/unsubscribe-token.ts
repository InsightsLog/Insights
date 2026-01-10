import { createHmac, timingSafeEqual } from "crypto";

/**
 * Secret key for signing unsubscribe tokens.
 * In production, this should be set via environment variable.
 */
function getTokenSecret(): string {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!secret) {
    throw new Error("UNSUBSCRIBE_TOKEN_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Payload for unsubscribe token.
 */
export interface UnsubscribeTokenPayload {
  userId: string;
  indicatorId: string;
  // Token expiration timestamp (epoch ms)
  // Tokens expire after 90 days by default
  exp: number;
}

/**
 * Generate a signed unsubscribe token.
 * Token format: base64(payload).signature
 *
 * @param userId - User ID to unsubscribe
 * @param indicatorId - Indicator ID to unsubscribe from
 * @param expirationDays - Token validity in days (default: 90)
 * @returns Signed token string
 */
export function generateUnsubscribeToken(
  userId: string,
  indicatorId: string,
  expirationDays = 90
): string {
  const exp = Date.now() + expirationDays * 24 * 60 * 60 * 1000;
  const payload: UnsubscribeTokenPayload = { userId, indicatorId, exp };

  // Encode payload as base64
  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson).toString("base64url");

  // Sign payload with HMAC-SHA256
  const secret = getTokenSecret();
  const signature = createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Validate and parse an unsubscribe token.
 *
 * @param token - Token string to validate
 * @returns Parsed payload if valid, null otherwise
 */
export function validateUnsubscribeToken(
  token: string
): UnsubscribeTokenPayload | null {
  try {
    // Split token into payload and signature
    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [payloadBase64, receivedSignature] = parts;

    // Verify signature
    const secret = getTokenSecret();
    const expectedSignature = createHmac("sha256", secret)
      .update(payloadBase64)
      .digest("base64url");

    // Use timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedSignature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return null;
    }

    // Decode and parse payload
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString(
      "utf-8"
    );
    const payload = JSON.parse(payloadJson) as UnsubscribeTokenPayload;

    // Check expiration
    if (payload.exp < Date.now()) {
      return null;
    }

    // Validate payload structure
    if (!payload.userId || !payload.indicatorId || !payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
