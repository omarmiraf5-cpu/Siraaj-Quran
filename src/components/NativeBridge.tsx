"use client";

import { useEffect } from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

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
  }, []);

  return null;
}
