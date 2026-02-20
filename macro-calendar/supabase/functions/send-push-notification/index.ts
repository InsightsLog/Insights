/**
 * Edge Function: send-push-notification
 * Task: T420, T512
 *
 * Sends push notifications to all subscribed devices for a given user
 * when a watched indicator releases.
 *
 * Supports two subscription types:
 *   - 'web'  — Web Push Protocol (RFC 8030) with VAPID authentication
 *   - 'expo' — Expo Push API (https://exp.host/--/api/v2/push/send)
 *
 * Expects a POST body:
 * {
 *   user_id: string,
 *   title: string,
 *   body: string,
 *   url?: string
 * }
 *
 * For web push, VAPID keys must be set as environment variables:
 *   VAPID_PUBLIC_KEY  – base64url-encoded uncompressed EC public key
 *   VAPID_PRIVATE_KEY – base64url-encoded EC private key scalar
 *   VAPID_SUBJECT     – mailto: or https: URI identifying the sender
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@macrocalendar.com";

// ---------------------------------------------------------------------------
// VAPID helper – build a JWT signed with ES256 for Web Push authentication
// ---------------------------------------------------------------------------

/**
 * Decode a base64url string into a Uint8Array.
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a Uint8Array to a base64url string.
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Build a VAPID JWT and return the Authorization header value.
 */
async function buildVapidAuthHeader(audience: string): Promise<string> {
  // Import the VAPID private key (raw EC scalar, P-256)
  const privateKeyBytes = base64urlDecode(VAPID_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    // Wrap the raw scalar in a PKCS#8 structure for P-256
    buildPkcs8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // JWT header + payload
  const header = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: VAPID_SUBJECT })
    )
  );

  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigRaw = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, sigInput);

  // Web Crypto returns DER-encoded signature; convert to raw r||s (64 bytes)
  const sig = base64urlEncode(derToRaw(new Uint8Array(sigRaw)));
  const token = `${header}.${payload}.${sig}`;

  return `vapid t=${token},k=${VAPID_PUBLIC_KEY}`;
}

/**
 * Convert a raw 32-byte EC private key scalar into a minimal PKCS#8 DER structure
 * that WebCrypto's importKey accepts for P-256.
 *
 * PKCS#8 DER for an EC private key wraps an ECPrivateKey (RFC 5915):
 *   SEQUENCE {
 *     INTEGER 0                         -- version
 *     SEQUENCE { OID ecPublicKey, OID P-256 }  -- AlgorithmIdentifier
 *     OCTET STRING { ECPrivateKey }     -- privateKey
 *   }
 */
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // ECPrivateKey (RFC 5915):
  //   SEQUENCE { INTEGER 1, OCTET STRING <rawKey> }
  const ecPrivKey = concat([
    new Uint8Array([0x30]), // SEQUENCE
    derLen(
      concat([
        new Uint8Array([0x02, 0x01, 0x01]), // INTEGER 1
        concat([new Uint8Array([0x04, rawKey.length]), rawKey]),
      ])
    ),
  ]);

  // AlgorithmIdentifier: ecPublicKey + P-256
  const algorithmId = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (ecPublicKey)
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (P-256)
  ]);

  // privateKey OCTET STRING wrapping the ECPrivateKey
  const privateKeyOctet = concat([
    new Uint8Array([0x04]),
    derLen(ecPrivKey),
    ecPrivKey,
  ]);

  // Top-level PKCS#8 SEQUENCE
  const pkcs8 = concat([
    new Uint8Array([0x30]),
    derLen(
      concat([
        new Uint8Array([0x02, 0x01, 0x00]), // INTEGER 0 (version)
        algorithmId,
        privateKeyOctet,
      ])
    ),
  ]);

  return pkcs8.buffer;
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function derLen(content: Uint8Array): Uint8Array {
  if (content.length < 128) {
    return concat([new Uint8Array([content.length]), content]);
  }
  const lenBytes = Math.ceil(Math.log2(content.length + 1) / 8);
  const header = new Uint8Array(1 + lenBytes);
  header[0] = 0x80 | lenBytes;
  for (let i = lenBytes - 1; i >= 0; i--) {
    header[1 + i] = content.length & 0xff;
  }
  return concat([header, content]);
}

/**
 * Convert a DER-encoded ECDSA signature to the raw r||s format
 * required by the Web Push JWT.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 30 <len> 02 <rlen> <r> 02 <slen> <s>
  let offset = 2; // skip SEQUENCE tag + length
  const rLen = der[offset + 1];
  offset += 2;
  const r = der.slice(offset, offset + rLen);
  offset += rLen + 2; // skip INTEGER tag + length
  const sLen = der[offset - 1];
  const s = der.slice(offset, offset + sLen);

  // Pad to 32 bytes each
  const raw = new Uint8Array(64);
  raw.set(r.slice(-32), 32 - Math.min(r.length, 32));
  raw.set(s.slice(-32), 64 - Math.min(s.length, 32));
  return raw;
}

// ---------------------------------------------------------------------------
// Web Push encryption helper (RFC 8291 / draft-ietf-webpush-encryption-08)
// ---------------------------------------------------------------------------

interface PushKeys {
  p256dh: string;
  auth: string;
}

/**
 * Encrypt a plaintext message for delivery to a push subscription endpoint
 * using ECDH + AES-128-GCM as defined in RFC 8291.
 *
 * Returns the encrypted ciphertext, the ephemeral sender public key (raw),
 * and the random salt.
 */
async function encryptPayload(
  plaintext: Uint8Array,
  keys: PushKeys
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();

  // Import the receiver's public key (uncompressed P-256 point)
  const receiverPublicKeyBytes = base64urlDecode(keys.p256dh);
  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    receiverPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  // Generate an ephemeral ECDH key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export sender public key (uncompressed)
  const senderPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderKeyPair.publicKey)
  );

  // Derive shared secret via ECDH
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPublicKey },
    senderKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // auth secret from subscription
  const authSecret = base64urlDecode(keys.auth);

  // Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive the content encryption key and nonce (RFC 8291 §3.4)
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const ikm = await hkdf(sharedSecret, authSecret, authInfo, 32);

  const keyInfo = buildInfo("aesgcm", receiverPublicKeyBytes, senderPublicKeyRaw);
  const nonceInfo = buildInfo("nonce", receiverPublicKeyBytes, senderPublicKeyRaw);

  const contentKey = await hkdf(ikm, salt, keyInfo, 16);
  const nonce = await hkdf(ikm, salt, nonceInfo, 12);

  // Import the content key and encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add a 2-byte padding delimiter (0x00) before the plaintext
  const paddedPlaintext = concat([new Uint8Array(2), plaintext]);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPlaintext
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    serverPublicKey: senderPublicKeyRaw,
    salt,
  };
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HKDF" }, false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: ikm, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

function buildInfo(
  encoding: string,
  receiverKey: Uint8Array,
  senderKey: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const label = encoder.encode(`Content-Encoding: ${encoding}\0P-256\0`);
  const receiverLen = new Uint8Array(2);
  new DataView(receiverLen.buffer).setUint16(0, receiverKey.length);
  const senderLen = new Uint8Array(2);
  new DataView(senderLen.buffer).setUint16(0, senderKey.length);
  return concat([label, receiverLen, receiverKey, senderLen, senderKey]);
}

// ---------------------------------------------------------------------------
// Send a single push notification
// ---------------------------------------------------------------------------

interface PushSubscription {
  endpoint: string;
  keys: PushKeys;
}

async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string }
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const { ciphertext, serverPublicKey, salt } = await encryptPayload(plaintext, subscription.keys);

    // Derive the audience from the endpoint URL (origin only)
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const authHeader = await buildVapidAuthHeader(audience);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        Encryption: `salt=${base64urlEncode(salt)}`,
        "Crypto-Key": `dh=${base64urlEncode(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
        TTL: "86400",
      },
      body: ciphertext,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription is no longer valid — caller should delete it
      return { success: false, status: response.status, error: "subscription_expired" };
    }

    return { success: response.ok, status: response.status };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Expo Push API helper (T512)
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string; expoPushToken?: string };
}

/**
 * Send notifications to one or more Expo push tokens via the Expo Push API.
 * Returns the tickets array from the API response.
 */
async function sendExpoNotifications(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<{ token: string; ticket: ExpoPushTicket }[]> {
  if (tokens.length === 0) return [];

  const messages: ExpoMessage[] = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    sound: "default",
    ...(payload.data ? { data: payload.data } : {}),
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error("Expo Push API error:", response.status, await response.text());
      return tokens.map((token) => ({
        token,
        ticket: { status: "error" as const, message: `HTTP ${response.status}` },
      }));
    }

    const json = await response.json() as { data?: ExpoPushTicket[] };
    if (!Array.isArray(json.data)) {
      console.error("Unexpected Expo Push API response shape:", JSON.stringify(json));
      return tokens.map((token) => ({
        token,
        ticket: { status: "error" as const, message: "Unexpected response shape" },
      }));
    }
    return tokens.map((token, i) => ({
      token,
      ticket: json.data![i] ?? { status: "error" as const, message: "No ticket returned" },
    }));
  } catch (err) {
    console.error("Failed to call Expo Push API:", err);
    return tokens.map((token) => ({
      token,
      ticket: { status: "error" as const, message: String(err) },
    }));
  }
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

interface RequestBody {
  user_id: string;
  title: string;
  body: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user_id, title, body: notifBody, url } = body;

  if (!user_id || !title || !notifBody) {
    return new Response(JSON.stringify({ error: "user_id, title, and body are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch all push subscriptions for the user (web and expo)
  const { data: subscriptions, error: dbError } = await supabase
    .from("push_subscriptions")
    .select("id, token_type, endpoint, keys, expo_token")
    .eq("user_id", user_id);

  if (dbError) {
    console.error("Failed to fetch push subscriptions:", dbError);
    return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(
      JSON.stringify({ message: "No push subscriptions found for user", sent: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Split subscriptions by type
  const webSubs = subscriptions.filter((s) => (s.token_type ?? "web") === "web");
  const expoSubs = subscriptions.filter((s) => s.token_type === "expo");

  // --- Web push ---
  const webResults = VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY
    ? await Promise.all(
        webSubs.map(async (sub) => {
          const result = await sendPushToSubscription(
            { endpoint: sub.endpoint as string, keys: sub.keys as PushKeys },
            { title, body: notifBody, url }
          );

          // Remove expired/invalid subscriptions automatically
          if (result.error === "subscription_expired") {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }

          return { id: sub.id, type: "web", ...result };
        })
      )
    : webSubs.map((sub) => ({
        id: sub.id,
        type: "web",
        success: false,
        error: "VAPID keys not configured",
      }));

  // --- Expo push ---
  const expoTokens = expoSubs
    .map((s) => s.expo_token as string)
    .filter(Boolean);

  const expoTickets = await sendExpoNotifications(expoTokens, {
    title,
    body: notifBody,
    data: url ? { url } : undefined,
  });

  // Remove invalid Expo tokens (DeviceNotRegistered error)
  await Promise.all(
    expoTickets
      .filter((t) => t.ticket.details?.error === "DeviceNotRegistered")
      .map(async ({ token }) => {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user_id)
          .eq("expo_token", token);
      })
  );

  const expoResults = expoTickets.map(({ token, ticket }) => ({
    id: expoSubs.find((s) => s.expo_token === token)?.id ?? token,
    type: "expo",
    success: ticket.status === "ok",
    error: ticket.status === "error" ? ticket.message : undefined,
  }));

  const allResults = [...webResults, ...expoResults];
  const sent = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success).length;

  console.log(`Push notifications sent: ${sent}, failed: ${failed}`);

  return new Response(
    JSON.stringify({ message: "Push notifications processed", sent, failed, results: allResults }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
