# Push notifications

The app can now send a notice to a phone: an absence alert, a child finishing a
surah or a juz', and anything else the portal raises as a notice. The code is in
place. It does nothing until you add the keys below, and the portal works exactly
as before without them.

**Who gets them:** teachers, the office and parents who allow notifications in
the app. Students (children) are never sent any. The phone asks once, after
someone signs in. A notice goes to the phone only the first time it is raised.

**How it works:** the app gives the phone's address to the portal
(`/api/push/register`, kept in the `push_devices` table). When the portal raises
a notice (`notify()` in `src/lib/attendanceServer.ts`) it also sends it to that
person's phones (`src/lib/pushServer.ts`): iPhones through Apple, Android phones
through Google. Signing out stops it for that phone.

## 1. Database

Run `mydiiwaan-update-19.sql` once in the Supabase SQL editor. It makes the
`push_devices` table.

## 2. iPhone (Apple)

1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → **+**.
   Name it `MyDiiwaan push`, tick **Apple Push Notifications service (APNs)**,
   continue, register, **Download** the `.p8` file. Apple lets you download it
   once. Keep it private. Note the **Key ID** and your **Team ID** (top right of
   the page, or Membership).
2. Identifiers → `com.mydiiwaan.app` → tick **Push Notifications** → Save.
3. In Vercel → Settings → Environment Variables, add (Production):
   - `APNS_KEY_ID`: the Key ID
   - `APNS_TEAM_ID`: your Team ID
   - `APNS_KEY`: the full text of the `.p8` file (the lines between and
     including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`;
     pasting it as it is works)
   - `APNS_BUNDLE_ID`: `com.mydiiwaan.app` (the default, so optional)
4. In Xcode, open the project, select the **App** target → Signing &
   Capabilities. **Push Notifications** should already show, because
   `App.entitlements` is set. If it does not, click **+ Capability** and add
   **Push Notifications**.
5. Redeploy on Vercel so it picks up the variables.

Test builds from Xcode use Apple's *sandbox*, which this production setup does
not reach. Test with a **TestFlight** build, which uses the production service.

## 3. Android (Google)

1. console.firebase.google.com → create a project (or use one) → add an Android
   app with the package name `com.mydiiwaan.app`.
2. Download `google-services.json` and put it in `android/app/` (it is ignored by
   git on purpose; the build workflow needs it as a secret, see below).
3. Firebase → Project settings → **Service accounts** → **Generate new private
   key**. In Vercel, add `FCM_SERVICE_ACCOUNT_JSON` with the full text of that
   JSON file.
4. Redeploy on Vercel.

For the GitHub build (`docs/PUBLISHING.md`), add the contents of
`google-services.json` as a secret and write it to `android/app/google-services.json`
before the build step.

## 4. App Store and Play answers

- **Apple App Privacy:** add **Device ID**, used for App Functionality, linked to
  the user, not used for tracking. (The app's `PrivacyInfo.xcprivacy` already says so.)
- **Google Data safety:** add **Device or other IDs**, collected, App functionality,
  not shared.
- The privacy policy page already mentions it.
- Push needs a **new build** of the app (the plugin is native). Raise the build
  number and archive again. Websites changes alone do not add it.

## 5. Check it works

Sign in as a teacher in the TestFlight or installed Android app and allow
notifications. Mark a child absent for five school days in a row, or finish a
surah, and the notice should arrive on the phone of the parent or office it is for.
Look in the Vercel logs for lines beginning `Push:` if it does not.
