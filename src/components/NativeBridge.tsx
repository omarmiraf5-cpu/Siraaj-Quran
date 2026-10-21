"use client";

import { useEffect } from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";

const PUSH_TOKEN_KEY = "push_token";

/**
 * Asks for permission to send notices to this phone and tells the portal where
 * to send them. Only for staff and parents, once someone is signed in; children
 * are not sent notifications. Asked once: the phone remembers the answer.
 */
async function registerForPush() {
  try {
    const supabase = createClient();
    const user = await sessionUser(supabase);
    if (!user) return;
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!me || me.role === "student") return;

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;

    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener("registration", async ({ value }) => {
      try {
        const res = await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: value, platform: Capacitor.getPlatform() }),
        });
        if (res.ok) localStorage.setItem(PUSH_TOKEN_KEY, value);
      } catch {
        /* Tried again next time the app opens. */
      }
    });
    await PushNotifications.register();
  } catch {
    /* Push is a convenience; the portal works without it. */
  }
}

/** Stops sending this phone the signed-out person's notices. */
export async function forgetPushToken() {
  try {
    const token = localStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    localStorage.removeItem(PUSH_TOKEN_KEY);
    await fetch("/api/push/register", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), keepalive: true });
  } catch {
    /* Nothing more to do. */
  }
}

/**
 * Small adjustments that only apply inside the MyDiiwaan iOS/Android app
 * (the same site, loaded in the native shell). In a browser it does nothing.
 *
 * - Tags <html> with `native-app`, for any styling that should differ.
 * - Stops iOS zooming the page in when a text field is tapped: the app's
 *   14px inputs trigger it, and an app, unlike a browser tab, gives no
 *   obvious way back out. Pinch-zoom in a browser is left alone.
 * - Light status-bar icons, over the navy strip the root layout draws
 *   behind the status bar.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.documentElement.classList.add("native-app");

    const viewport = document.querySelector('meta[name="viewport"]');
    const content = viewport?.getAttribute("content") ?? "";
    if (viewport && !/maximum-scale/.test(content)) {
      viewport.setAttribute("content", `${content}, maximum-scale=1`);
    }

    SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
    void registerForPush();
    // Someone signing in after the app opened (the page does not reload).
    const { data: sub } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void registerForPush();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
