import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The MyDiiwaan app for iOS and Android.
 *
 * The app is the live portal in a native shell: it loads mydiiwaan.com, so a
 * change deployed to the site reaches the app at the same moment, with no
 * store resubmission. What the shell adds is native: the location check
 * behind staff sign-in, the splash screen and icon, system bars that follow
 * the app's theme, and an offline screen instead of a browser error.
 *
 * Links to anywhere other than mydiiwaan.com (WhatsApp, email, a school's
 * own website) open in the phone's browser, not inside the app.
 */
const config: CapacitorConfig = {
  appId: "com.mydiiwaan.app",
  appName: "MyDiiwaan",
  // Only the offline screen and a hand-off page live in the app itself.
  webDir: "mobile/www",
  backgroundColor: "#0e2347",
  // Lets the site recognise the app (e.g. in request logs) without sniffing.
  appendUserAgent: "MyDiiwaanApp",
  server: {
    url: "https://mydiiwaan.com",
    // Both spellings of the domain stay inside the app, so a redirect from
    // one to the other doesn't bounce the user out to the browser.
    allowNavigation: ["mydiiwaan.com", "www.mydiiwaan.com"],
    errorPath: "offline.html",
  },
  ios: {
    // The page draws edge to edge and pads itself with
    // env(safe-area-inset-*), which the viewport's viewport-fit=cover enables.
    contentInset: "never",
  },
  android: {
    // Remote content only over HTTPS.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#24272b",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    SystemBars: {
      // Correct env(safe-area-inset-*) values on every Android version, and
      // --safe-area-inset-* CSS variables as a fallback.
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
