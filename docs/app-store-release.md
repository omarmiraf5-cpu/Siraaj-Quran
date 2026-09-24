# Putting MyDiiwaan on the App Store and Google Play

This is the list of things only you can do. The app project is already set up
(name **MyDiiwaan**, id **com.mydiiwaan.app**, version **1.0.0**, build **1**).
You create the store accounts, sign the apps, and fill in the forms. A Mac
with Xcode is required for the Apple upload. Building the Android file can be
done on any computer with Android Studio, or from GitHub (see
`docs/PUBLISHING.md` if you would rather not install those tools).

The phone apps show the live website. A change to the website appears in the
apps straight away. You only submit a new app version when something in the
phone shell changes (the icon, permissions, or a new phone feature).

---

## 1. Check the website first

The address the apps open is **https://www.mydiiwaan.com**.

The bare name **mydiiwaan.com** is already fixed: it is a Cloudflare CNAME
pointing at Vercel, and it redirects (HTTP 308) to the www address. Open both
in a browser. Both should end on `www.mydiiwaan.com` and show the sign-in page.

In **Supabase** (the sign-in service), open your project → **Authentication** →
**URL Configuration**:

- **Site URL:** `https://www.mydiiwaan.com`
- **Redirect URLs:** add `https://www.mydiiwaan.com/**`

The app signs people in with email and password, so it does not depend on a
redirect today. Set the Site URL anyway, so any future password email uses the
right address. You can also leave `https://mydiiwaan.com/**` on the allow list
during the changeover.

In **Vercel** → project → **Settings** → **Domains**, `www.mydiiwaan.com` should
be the primary domain, and `mydiiwaan.com` should redirect to it.

Privacy policy (use this exact link in both stores):

**https://www.mydiiwaan.com/privacy**

Support page: **https://www.mydiiwaan.com/support**

Account deletion page: **https://www.mydiiwaan.com/account**

---

## 2. Make a review school

Apple and Google will sign in and click around. On your `/platform` page,
create a school just for them, for example **MyDiiwaan Review School**, with:

- you as the admin
- one teacher
- one parent, linked to a child
- one student with a 4-digit PIN
- the school's location set to your real school

Write the emails, passwords, school code and PIN down. You will paste them
into both stores. Do not send Apple the sample logins from the README
(`admin@mydiiwaan.com` / `admin123` and so on). Those are a demo switch, not
a private school, and they skip the real location check.

Set the school location to your real premises. A reviewer who is not there
should see that staff sign-in only works at the school. That is the correct
behaviour. Say so in the review notes (section 6).

---

## 3. Apple Developer account

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enrol.
   The cost is 99 US dollars a year. Approval can take a day or two; a company
   account takes longer than a personal one.
2. When you are in, open [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → **Apps** → **+** → **New App**.
   - Platform: iOS
   - Name: `MyDiiwaan` (if that name is taken: `MyDiiwaan – Qur'an School`)
   - Language: English
   - Bundle ID: `com.mydiiwaan.app` (register it under Certificates, IDs & Profiles → Identifiers if it is not in the list)
   - SKU: `mydiiwaan-ios`

---

## 4. iOS signing (on a Mac, in Xcode)

Apple will not accept an app that is not signed with your account. Xcode
creates the certificate and the provisioning profile for you. You do not make
them by hand.

1. Install **Xcode** from the Mac App Store and open it once so it can finish
   installing.
2. In Xcode, sign in with the Apple ID on the developer account
   (**Xcode → Settings → Accounts**).
3. Open the file `ios/App/App.xcodeproj` (inside this project).
4. Click the blue **App** project, then the **App** target, then **Signing & Capabilities**.
5. Tick **Automatically manage signing**.
6. Team: your developer team.
7. Confirm the bundle identifier is exactly `com.mydiiwaan.app`. Do not change it.
8. Confirm **Version** is `1.0.0` and **Build** is `1`.

Xcode will create a development certificate and an App Store profile the first
time you archive. Leave those in Xcode. Do not email them, and do not put them
in GitHub.

---

## 5. Build the iOS app and send it to Apple

Still in Xcode, on the Mac:

1. At the top, set the run destination to **Any iOS Device (arm64)**, not a simulator.
2. Menu **Product → Archive**. Wait until the Organizer window opens.
3. Select the archive → **Distribute App** → **App Store Connect** → **Upload**.
4. Leave the defaults (upload symbols, manage signing automatically).
5. When it finishes, wait in App Store Connect → your app → **TestFlight**.
   Apple processes the file for about 10–30 minutes. Install it on your own
   iPhone with the TestFlight app before you submit it for review.

If Apple says the build number has already been used, change **Build** to `2`
(leave Version at `1.0.0`) and archive again. Every upload needs a higher
build number.

This project was prepared on a machine that is not a Mac, so the archive
itself was not built here. The Xcode project is ready for you to archive.

If you do not have a Mac, `docs/PUBLISHING.md` explains a GitHub build that
uploads to TestFlight for you. That path needs an App Store Connect API key
instead of Xcode. Use one path, not both, for the first upload, so you do not
create two build numbers by accident.

---

## 6. App Store listing

In App Store Connect, open the app → **1.0 Prepare for Submission**.

**Screenshots** (portrait). Apple requires these sizes. Take them on a device
or the Simulator after you have signed in to the review school. You need at
least three, and up to ten, for each size. Capture the sign-in screen, a
teacher's day, the Mushaf, and a parent's view.

| Device | Size in pixels |
|---|---|
| iPhone 6.9-inch (required) | 1320 × 2868, or 1290 × 2796, or 1260 × 2736 |
| iPad 13-inch (required, the app runs on iPad) | 2064 × 2752, or 2048 × 2732 |

Apple scales the 6.9-inch set to the smaller iPhones if you do not upload those.

**Text you can paste**

- Subtitle: `Qur'an school portal`
- Promotional text: `Lessons, attendance and Qur'an progress for your school — for the office, teachers, parents and students, in English, Somali and Arabic.`
- Keywords: `quran,madrasa,dugsi,hifz,halaqa,tajweed,mushaf,islamic school,attendance,teacher,parent`
- Description: the long description in `docs/PUBLISHING.md`, section C.
- Support URL: `https://www.mydiiwaan.com/support`
- Marketing URL: `https://www.mydiiwaan.com`
- Copyright: your name or the school's legal name, and the year.

**App Information**

- Category: **Education**. Secondary: **Productivity**.
- Content rights: the app plays Qur'an audio from islamic.network and
  everyayah.com, and shows Mushaf fonts loaded from jsDelivr. Answer **Yes**
  (it contains third-party content) only if you are satisfied you have the
  right to use that audio and those fonts. If you are not sure, decide that
  before you submit. See the open questions at the end.
- Age rating: complete the questionnaire honestly. There is no violence or
  gambling. Parents and teachers in the same school can message each other.
  Students are children. Apple sets the rating from your answers.

**App Privacy**

Privacy Policy URL: `https://www.mydiiwaan.com/privacy`

You do collect data. You do not track people across other companies' apps or
websites. Do not tick Tracking. There is no analytics.

| Data | Used for | Linked to the person | Tracking |
|---|---|---|---|
| Name | App functionality | Yes | No |
| Email address | App functionality | Yes | No |
| Phone number | App functionality | Yes | No |
| Precise location | App functionality | Yes | No |
| Other user content (lessons, notes, messages) | App functionality | Yes | No |
| Other financial info (school fees owed and paid, no card numbers) | App functionality | Yes | No |
| User ID | App functionality | Yes | No |

Location is read only when a teacher taps Sign in or Sign out, to check they
are at the school. The map pin is not stored. The distance from the school is.

**App Review Information**

Sign-in required: **Yes**. Put the teacher email and password in the username
and password boxes, and paste this note (fill in the blanks from section 2):

> MyDiiwaan is a portal for Qur'an schools. The school creates every account.
> Review logins — Teacher: EMAIL / PASSWORD. Parent: EMAIL / PASSWORD.
> Admin: EMAIL / PASSWORD. Student: on the sign-in screen tap Student, enter
> school code CODE, tap the student's name, PIN 1234.
> Staff sign-in only works within the school's radius, so from anywhere else
> it explains that the teacher is not on the premises. That is intended.
> Location is requested only when a teacher taps Sign in or Sign out.
> Delete account: menu → Account → Delete account. Please use a spare account
> if you try deletion, not the teacher login above.

Choose the build from TestFlight, then **Add for Review** → **Submit**.

---

## 7. If Apple says the app is "just a website" (guideline 4.2)

The app is the website in a native shell, which Apple sometimes rejects as
minimum functionality. These phone features are already in this version, so
you can reply with something like this:

> MyDiiwaan is the companion app for schools that already use the MyDiiwaan
> portal. It is not a general web browser. It adds native behaviour the site
> in Safari does not: a location check, through the phone's own location
> permission, so staff can only sign in on the school premises; a branded
> splash screen; an offline screen in English, Somali and Arabic when the
> school cannot be reached; pull-to-refresh; Android system-back navigation
> through the portal; and status-bar styling matched to the app. Accounts are
> issued by the school. Location is requested only at staff sign-in, never in
> the background, and never for students or parents.

Push notifications (for example an absence alert) are not in version 1.0. If
Apple still wants more, that is the next feature to add. It needs a push
service and a new submission. The project is ready for that plugin later; it
is deliberately not asking for notification permission yet.

---

## 8. Google Play account

1. Go to [play.google.com/console](https://play.google.com/console) and pay the
   one-time 25 US dollar fee. Finish the identity check. It can take several days.
2. A **personal** account created recently must run a **closed test with at
   least 12 testers for 14 days** before it can be public. Start that as soon
   as the first file is uploaded. An **organisation** account (it needs a
   D-U-N-S number) skips that wait.
3. **Create app**. Name: `MyDiiwaan`. Language: English. Type: App. Free.
   Accept the declarations.

---

## 9. Android keystore (do this once, then back it up)

Google identifies every future update by a keystore file. If you lose it, you
cannot update the app. You would have to publish a new app and ask every
school to install it again.

**Play App Signing** (accept it when you upload): Google holds the key that
users' phones actually trust. You hold a separate **upload key**, which only
proves that an update came from you. You still must not lose the upload key.

Create it on your own computer, not in this repository. In Android Studio:
**Build → Generate Signed App Bundle / APK → Android App Bundle → Create new…**

- Key store path: somewhere private, for example a folder outside this project,
  named `mydiiwaan-upload.jks`
- Passwords: long, and different if you like. Save them in a password manager.
- Alias: `mydiiwaan`
- Validity: 25 years or more
- Certificate name: your name or MyDiiwaan

Or, if you have the Java tools installed, in a terminal **outside** the project
folder:

```
keytool -genkeypair -v -keystore mydiiwaan-upload.jks -alias mydiiwaan -keyalg RSA -keysize 2048 -validity 10000
```

**Backups**

- Password manager: both passwords and the alias.
- A second copy of the `.jks` file on an encrypted drive or USB that you keep
  offline.
- Do not email the file to yourself without a password on it.
- Do not commit it. The Android project ignores `*.jks` and `*.keystore`.

There is no keystore in this repository, and none was created here.

---

## 10. Build the Android App Bundle

In Android Studio, open the `android` folder of this project.

1. **Build → Generate Signed App Bundle / APK**.
2. Choose **Android App Bundle**.
3. Select the keystore from section 9.
4. Build variant: **release**.
5. The file you want is `app-release.aab`.

The app id is `com.mydiiwaan.app`. The version people see is `1.0.0`. The
version code (the build number Google uses) is `1`. The next upload must use
`2`, then `3`, and so on. The name people see can stay `1.0.0` until you want
to call it `1.0.1`.

Target Android version is API 36, which is what Google Play requires for new
apps as of 31 August 2026.

The GitHub workflow in `docs/PUBLISHING.md` can build this same `.aab` if you
would rather not install Android Studio. The keystore then lives in GitHub
secrets, not in the repository. Keep your own backup either way.

---

## 11. Play Store listing and forms

**Main store listing**

- App name: `MyDiiwaan`
- Short description (80 characters max):
  `Qur'an school portal: lessons, attendance and progress for teachers and parents`
- Full description: section C of `docs/PUBLISHING.md`.
- App icon, 512×512 PNG: `store/play-icon-512.png` in this project.
- Feature graphic, 1024×500: `store/play-feature-graphic-1024x500.png`.
  You can replace it with one that has a tagline if you prefer.
- Phone screenshots: at least **2**, portrait, PNG or JPEG. Each side between
  320 and 3840 pixels. A 9:16 phone screenshot is the usual shape (for example
  1080 × 1920). Take the same screens you took for Apple.
- Tablet screenshots are optional. The iPad shots work for a 10-inch tablet.
- Category: **Education**.
- Email: `omar.miraf5@gmail.com` (change this on the form if that is not the
  address you want parents to see).
- Website: `https://www.mydiiwaan.com`

**Policy → App content**

- Privacy policy: `https://www.mydiiwaan.com/privacy`
- App access: all features need a login. Add the same demo logins and the same
  note as in section 6.
- Ads: No.
- Content rating: start the questionnaire, category Education or Reference.
  Answer honestly. Users in a school can message each other. Submit the
  questionnaire; Google emails you the rating.
- Target audience: include the ages of the students (for example 5 and up) as
  well as 18+. The app has no ads and no advertising or analytics SDKs.
  Location is asked only of staff, and only when they tap Sign in or Sign out.
  In the declaration, say that children use it through their school, which
  creates their accounts.
- News app: No. Government app: No. Financial features: None. Health: No.
- Data safety:
  - Data is collected. It is encrypted in transit. Users can request deletion.
  - Deletion is in the app: Account → Delete account, and at
    `https://www.mydiiwaan.com/account`.
  - Name, email, phone number: collected, required for staff and parents,
    app functionality.
  - Precise location: collected, app functionality, optional (staff only),
    processed ephemerally (the map pin is not kept; the distance is).
  - Other financial info (fees owed and paid): app functionality.
  - Messages: app functionality.
  - Other user-generated content (lessons, notes): app functionality.
  - Not shared with third parties for their own use. Not used for ads or analytics.

**Testing, then production**

Upload the `.aab` to **Internal testing** first and install it on your own
Android phone. Then closed testing if your account requires the 12-tester wait.
Then **Production**.

---

## 12. Icons and splash (already done)

The store icon and the phone icons are generated from files already in the
project:

- `assets/icon-only.png` — 1024×1024, no transparency (what Apple requires)
- `assets/icon-foreground.png` and `assets/icon-background.png` — Android adaptive icon
- `assets/splash.png` and `assets/splash-dark.png` — 2732×2732 splash

Phone-sized copies are already in the iOS and Android projects. You do not
need to regenerate them for this release. If you change the logo later, put a
new 1024×1024 PNG (no transparency) at `assets/icon-only.png` and ask a
developer to run `npm run assets:generate`.

---

## 13. What not to put in GitHub

- The Android `.jks` / keystore, and its passwords
- Apple certificates, provisioning profiles, or the `.p8` API key
- `google-services.json`, if you add push later

---

## 14. After it is live

Website changes show up in the apps on their own. For a new phone version,
raise the version (1.0.1, 1.1.0, …) and always raise the build number, then
archive again in Xcode and build a new `.aab`.

---

## Open questions

These are not blocking the project files, but you need to answer them before
the stores will approve the app:

1. Is **MyDiiwaan** free as an app name on both stores, or do you want the
   longer name `MyDiiwaan – Qur'an School`?
2. Should the public contact email stay `omar.miraf5@gmail.com`?
3. Please create the review school and send yourself the logins. They are not
   in the project, and they should not be.
4. Are you happy to declare rights to the Qur'an audio (islamic.network /
   everyayah.com) and the Mushaf fonts (the QCF font files loaded from
   jsDelivr)?
5. Will the Play account be a personal account (12 testers for 14 days) or an
   organisation account?
6. Do you want absence alerts as phone notifications in a later version? They
   are not in 1.0, on purpose.
