import "server-only";

import { createSign } from "node:crypto";
import { connect } from "node:http2";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Sends a notice to people's phones. iPhones are reached through Apple's push
 * service (APNs) with a key from the Apple Developer account; Android phones
 * through Firebase Cloud Messaging with a service account. Both are optional:
 * a platform whose keys are not set is skipped quietly, so the portal's own
 * notices keep working before push is switched on.
 *
 *   APNs:  APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (the .p8 file's text),
 *          APNS_BUNDLE_ID (default com.mydiiwaan.app)
 *   FCM:   FCM_SERVICE_ACCOUNT_JSON (the service-account key file's text)
 */

export interface PushMessage {
  title: string;
  body: string;
}

interface Device {
  id: string;
  platform: "ios" | "android";
  token: string;
}

const b64u = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/* ── Apple ─────────────────────────────────────────────────────────── */

let apnsJwt: { token: string; at: number } | null = null;

function apnsToken(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = process.env.APNS_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !key) return null;
  // Apple wants a fresh token between every 20 and 60 minutes.
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60 * 1000) return apnsJwt.token;
  const head = b64u(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64u(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const sig = createSign("SHA256").update(`${head}.${claims}`).sign({ key, dsaEncoding: "ieee-p1363" });
  const token = `${head}.${claims}.${b64u(sig)}`;
  apnsJwt = { token, at: Date.now() };
  return token;
}

/** Sends to iPhones; returns the ids of devices Apple says are gone. */
async function sendApns(devices: Device[], msg: PushMessage): Promise<string[]> {
  const jwt = apnsToken();
  if (!jwt || devices.length === 0) return [];
  const topic = process.env.APNS_BUNDLE_ID || "com.mydiiwaan.app";
  const host = process.env.APNS_HOST || "https://api.push.apple.com";
  const payload = JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" } });
  const gone: string[] = [];
  const client = connect(host);
  client.on("error", (e) => console.error("Push: APNs connection", e));
  try {
    await Promise.all(
      devices.map(
        (d) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${d.token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": topic,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
            });
            let status = 0;
            let text = "";
            req.on("response", (h) => (status = Number(h[":status"] ?? 0)));
            req.on("data", (c) => (text += c));
            req.on("end", () => {
              if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(text))) gone.push(d.id);
              else if (status !== 200) console.error("Push: APNs refused", status, text);
              resolve();
            });
            req.on("error", () => resolve());
            req.end(payload);
          })
      )
    );
  } finally {
    client.close();
  }
  return gone;
}

/* ── Google ────────────────────────────────────────────────────────── */

let fcmAccess: { token: string; expires: number } | null = null;

function serviceAccount(): { client_email: string; private_key: string; project_id: string } | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error("Push: FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

async function fcmToken(sa: { client_email: string; private_key: string }): Promise<string | null> {
  if (fcmAccess && fcmAccess.expires > Date.now() + 60_000) return fcmAccess.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64u(sig)}` }),
  });
  if (!res.ok) {
    console.error("Push: Google sign-in refused", res.status);
    return null;
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return fcmAccess.token;
}

async function sendFcm(devices: Device[], msg: PushMessage): Promise<string[]> {
  const sa = serviceAccount();
  if (!sa || devices.length === 0) return [];
  const access = await fcmToken(sa);
  if (!access) return [];
  const gone: string[] = [];
  await Promise.all(
    devices.map(async (d) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
        body: JSON.stringify({ message: { token: d.token, notification: { title: msg.title, body: msg.body } } }),
      }).catch(() => null);
      if (!res || res.ok) return;
      const text = await res.text().catch(() => "");
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) gone.push(d.id);
      else console.error("Push: FCM refused", res.status, text.slice(0, 200));
    })
  );
  return gone;
}

/**
 * Pushes each message to its recipient's phones. Never throws: the notice it
 * accompanies is already saved in the portal, so a failed push loses nothing.
 */
export async function sendPush(items: Array<{ userId: string; message: PushMessage }>): Promise<void> {
  try {
    if (items.length === 0) return;
    if (!process.env.APNS_KEY && !process.env.FCM_SERVICE_ACCOUNT_JSON) return;
    const admin = createAdminClient();
    const { data } = await admin
      .from("push_devices")
      .select("id, user_id, platform, token")
      .in("user_id", [...new Set(items.map((i) => i.userId))]);
    const devices = (data ?? []) as Array<Device & { user_id: string }>;
    if (devices.length === 0) return;

    // One send per distinct message, to every phone of everyone it is for.
    const groups = new Map<string, { message: PushMessage; users: Set<string> }>();
    for (const i of items) {
      const key = `${i.message.title}\u0000${i.message.body}`;
      const g = groups.get(key) ?? { message: i.message, users: new Set<string>() };
      g.users.add(i.userId);
      groups.set(key, g);
    }
    const dead: string[] = [];
    for (const g of groups.values()) {
      const mine = devices.filter((d) => g.users.has(d.user_id));
      const [a, f] = await Promise.all([
        sendApns(mine.filter((d) => d.platform === "ios"), g.message),
        sendFcm(mine.filter((d) => d.platform === "android"), g.message),
      ]);
      dead.push(...a, ...f);
    }
    if (dead.length > 0) await admin.from("push_devices").delete().in("id", dead);
  } catch (error) {
    console.error("Push: could not send", error);
  }
}
