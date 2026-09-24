# Publishing MyDiiwaan on the App Store and Google Play

The apps are the live portal in a native shell: they open
https://www.mydiiwaan.com, so **every change to the website reaches the apps
immediately**, with no store review. You only publish a new app version when
something native changes (the icon, permissions, a new plugin).

The steps only you can do — accounts, signing, screenshots, privacy forms —
are written out in plain language in `docs/app-store-release.md`. This file
is the GitHub build path that goes with them.

Builds run on GitHub — no Mac needed. You do everything below from a browser.

---

## 0. Before you start (once)

1. **Run the database update.** Supabase → SQL Editor → paste all of
   `supabase/schema.sql` → Run. It should say *Success*. Account deletion
   (which both stores require) needs it.
2. **Support email.** The privacy policy, support page and Account page give
   `omar.miraf5@gmail.com` (set in `src/lib/site.ts` — change it there, or
   ask Claude, and the site and apps follow at once; the store listings'
   contact email is typed into each store's form and changed there).
3. **Web address.** The app loads `https://www.mydiiwaan.com` directly. The
   bare `mydiiwaan.com` name is a Cloudflare CNAME to Vercel and 308-redirects
   to www. In Supabase → Authentication → URL Configuration, set Site URL to
   `https://www.mydiiwaan.com` and allow `https://www.mydiiwaan.com/**`.
4. **A review school.** Apple and Google test the app by signing in. On your
   `/platform` page, set up a school called e.g. *MyDiiwaan Review School*
   with a few students, one teacher, one parent (linked to a child) and
   yourself as admin, and give a student a PIN. Keep these logins for
   step A7 and B6. Set the school's location to your real school, so a
   reviewer sees the "not on the premises" message on staff sign-in rather
   than being able to sign in from anywhere.

---

## A. Apple — App Store

### A1. Register the app's ID
developer.apple.com → Account → **Certificates, IDs & Profiles** →
Identifiers → **+** → App IDs → App → Continue.
- Description: `MyDiiwaan`
- Bundle ID: **Explicit**, `com.mydiiwaan.app`
- Capabilities: leave the defaults → Continue → Register.

### A2. Create the app in App Store Connect
appstoreconnect.apple.com → **Apps** → **+** → New App.
- Platforms: iOS
- Name: `MyDiiwaan` (if taken: `MyDiiwaan – Qur'an School`)
- Primary language: English (U.S.) or English (Canada)
- Bundle ID: `com.mydiiwaan.app`
- SKU: `mydiiwaan-ios`
- User access: Full access

### A3. Create the key GitHub uses to upload builds
App Store Connect → **Users and Access** → **Integrations** →
App Store Connect API → **Team Keys** → **+**.
- Name: `GitHub builds`, Access: **Admin** → Generate.
- **Download** the key file (`AuthKey_XXXXXXXX.p8`) — you can only download
  it once. Note the **Key ID** (next to the key) and the **Issuer ID** (above
  the list).

Your **Team ID**: developer.apple.com → Account → Membership details.

### A4. Give GitHub the key
github.com/omarmiraf5-cpu/Siraaj-Quran → **Settings** → **Secrets and
variables** → **Actions** → **New repository secret**, four times:

| Name | Secret |
|---|---|
| `APPLE_TEAM_ID` | your Team ID |
| `ASC_KEY_ID` | the Key ID |
| `ASC_ISSUER_ID` | the Issuer ID |
| `ASC_KEY_P8` | open the `.p8` file (Files app → Quick Look, or any text editor) and paste **everything**, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |

### A5. Build and upload
GitHub → **Actions** → **Mobile apps — release** → **Run workflow**:
version `1.0.0`, platform `ios` → Run. It takes about 15–25 minutes. When it
finishes green, the build appears in App Store Connect → your app →
**TestFlight** after Apple processes it (10–30 minutes more).

If it fails, open the red step and send Claude the error.

### A6. Try it on your iPhone first
TestFlight tab → **Internal Testing** → + → add yourself → install the
**TestFlight** app from the App Store and open the invite. Check: sign in,
staff sign-in at school (it will ask for location), the Mushaf and
recitation, Account → Delete account (on a test account), and the offline
screen (turn on Airplane mode, reopen the app).

### A7. Fill in the listing
App Store Connect → your app → **1.0 Prepare for Submission**.
- **Screenshots**: from the `MyDiiwaan-store-images` zip —
  `App-Store-iPhone-6.9` into the 6.9" iPhone slot, `App-Store-iPad-13` into
  the 13" iPad slot. (Apple scales them for the other sizes.)
- **Promotional text, Description, Keywords, Subtitle**: see section C.
- **Support URL**: `https://www.mydiiwaan.com/support`
- **Marketing URL**: `https://www.mydiiwaan.com`
- **Build**: choose the one from TestFlight.
- **App Review Information** → Sign-in required: yes → give the **teacher**
  login from step 0.4, and paste into Notes:

  > MyDiiwaan is a portal for Qur'an schools; accounts are created by the
  > school. Demo logins on our review school — Teacher: *email / password*.
  > Parent: *email / password*. Admin: *email / password*. Student: on the
  > sign-in screen tap Student, enter school code *code*, tap a name, PIN
  > *1234*.
  > Staff sign-in (teacher dashboard) only works within 150 m of the school,
  > so from elsewhere it explains the teacher is not on the premises — this
  > is intended. Location is only requested when a teacher taps Sign in.
  > Delete account: menu → Account → Delete account.

**App Information** (left menu):
- Category: **Education**; secondary **Productivity**
- Content rights: the app shows third-party content (Qur'an recitations
  streamed from EveryAyah / Islamic Network, and the King Fahd Complex Mushaf
  font). Answer *Yes* and confirm you have the rights to use it.
- Age rating: answer the questionnaire honestly (no violence, gambling etc.;
  parents and teachers of the same school can message each other). Apple sets
  the rating from your answers.

**App Privacy** (left menu) → Privacy Policy URL:
`https://www.mydiiwaan.com/privacy`, then **Get Started** → *Yes, we collect data*:

| Data type | Used for | Linked to the person | Tracking |
|---|---|---|---|
| Contact Info → Name | App Functionality | Yes | No |
| Contact Info → Email Address | App Functionality | Yes | No |
| Contact Info → Phone Number | App Functionality | Yes | No |
| Location → Precise Location | App Functionality | Yes | No |
| User Content → Other User Content (lessons, notes, messages) | App Functionality | Yes | No |
| Financial Info → Other Financial Info (school fees owed/paid) | App Functionality | Yes | No |
| Identifiers → User ID | App Functionality | Yes | No |

Answer **No** to tracking, and don't add Usage Data or Diagnostics — the
app has no analytics.

### A8. Submit
**Add for Review** → **Submit**. Review usually takes 1–3 days. If Apple
replies, send Claude the message.

> If Apple says the app is "a repackaged website" (guideline 4.2), reply that
> it uses native location for on-premises staff sign-in, a native offline
> screen, and is the companion app for schools already using MyDiiwaan — and
> tell Claude; the next native feature to add would be push notifications for
> absence alerts.

---

## B. Google — Google Play

### B1. Developer account
play.google.com/console → sign up ($25 once) and complete identity
verification.
- A **personal** account created recently must run a **closed test with at
  least 12 testers for 14 days** before it can publish to everyone — start
  that early (B5). An **organization** account (needs a D-U-N-S number)
  skips it.

### B2. Give GitHub the upload key
Open **MyDiiwaan-Android-upload-key-secrets.txt** (sent with this guide) and
add its four secrets the same way as A4: `ANDROID_KEY_ALIAS`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`,
`ANDROID_KEYSTORE_BASE64`. Keep that file and `mydiiwaan-upload.jks`
somewhere private and safe: every update must be signed with this key.

### B3. Build
GitHub → Actions → **Mobile apps — release** → Run workflow: version
`1.0.0`, platform `android`. When it's green, open the run and download the
**google-play** file under *Artifacts* (a zip containing `app-release.aab`;
unzip it).

### B4. Create the app
Play Console → **Create app**: name `MyDiiwaan`, language English, **App**,
**Free** → accept the declarations → Create.

### B5. First upload (testing)
Test and release → **Testing → Closed testing** (or Internal testing, to try
it yourself first) → Create track/release → **upload the .aab** → accept
**Play App Signing** (Google keeps the final signing key; yours is only for
uploads) → release notes: `First release` → Save → Review → Start rollout.
Add testers by email list, and share the opt-in link with them.

### B6. App content (left menu → Policy → App content)
- **Privacy policy**: `https://www.mydiiwaan.com/privacy`
- **App access**: all functionality needs a login → add the demo logins and
  the same notes as A7.
- **Ads**: No ads.
- **Content rating**: questionnaire → category *Education/Reference*; answer
  honestly (users can message each other within their school).
- **Target audience**: students are children, so include their ages (for
  example 5–12 and 13–15) alongside 18+. The app meets the Families rules:
  no ads, no analytics or advertising SDKs, and location is asked only of
  staff. Explain in the declaration that children use it through their
  school, which creates their accounts.
- **Data safety**:
  - Collects data: Yes. Encrypted in transit: Yes. Users can request
    deletion: Yes — in the app (Account → Delete account) and at
    `https://www.mydiiwaan.com/account`.
  - Personal info: Name, Email address, Phone number — App functionality,
    required.
  - Location: Precise location — App functionality, *processed ephemerally*
    (only the distance from school is kept), optional (staff only).
  - Financial info: Other financial info (school fees) — App functionality.
  - Messages: Other in-app messages — App functionality.
  - App activity: Other user-generated content (lessons, notes) — App
    functionality.
  - Not shared with third parties; no data used for ads or analytics.
- **Government app**: No. **Financial features**: None. **Health**: No.

### B7. Store listing (Grow → Store presence → Main store listing)
- App name, short and full description: section C.
- App icon: `Google-Play/googleplay-icon-512.png`
- Feature graphic: `Google-Play/googleplay-feature-graphic-1024x500.png`
- Phone screenshots: the `Google-Play/googleplay-phone-*.png` files.
- Tablet screenshots (optional): the iPad images work for 10" tablets.
- Category: **Education**. Contact email: `omar.miraf5@gmail.com`.
  Website: `https://www.mydiiwaan.com`.

### B8. Production
After the closed test has run (12 testers, 14 days, for a personal account),
Play Console → **Production** → apply for access → create a release with the
same (or a newer) .aab → Review → Roll out.

---

## C. Listing text (ready to paste)

**Name**: MyDiiwaan

**Subtitle** (Apple, 30 max): `Qur'an school portal`

**Short description** (Google, 80 max):
`Qur'an school portal: lessons, attendance and progress for teachers and parents`

**Keywords** (Apple, 100 max):
`quran,madrasa,dugsi,hifz,halaqa,tajweed,mushaf,islamic school,attendance,teacher,parent`

**Promotional text** (Apple, 170 max):
`Lessons, attendance and Qur'an progress for your school — for the office, teachers, parents and students, in English, Somali and Arabic.`

**Description**:

```
MyDiiwaan is the portal for Qur'an schools — madrasas, dugsi and halaqas. The school office, teachers, parents and students each sign in to their own space.

FOR TEACHERS
• Sign in when you arrive — it only works on the school premises
• Take the register in seconds; parents and the office are told after five absences in a row
• Lessons come straight from each student's yearly plan, with the exact pages
• See each lesson highlighted in the Mushaf, and tap an ayah to hear it recited
• Rate recitation, add notes, and confirm a whole surah before moving on

FOR PARENTS
• Follow every portion, with the teacher's rating and note
• See whether your child is ahead or behind their yearly plan
• Message the teacher or report an absence in a couple of taps

FOR STUDENTS
• Sign in with your name and a 4-digit PIN — no email needed
• Today's three portions, with points and levels that make revision a habit
• Qa'idah, Tajweed and the Forty Hadith alongside the Mushaf

FOR THE OFFICE
• Students, teachers, parents and halaqas in one place
• Staff attendance, lateness and absence reports
• A school calendar that plans and attendance follow

In English, Somali and Arabic, with light and dark themes.

MyDiiwaan is for schools that use the MyDiiwaan portal: your school gives you your sign-in.
```

---

## D. Later updates

- **Website changes** go live in the apps straight away — nothing to do.
- **New app version** (icon, permissions, native features): run
  *Mobile apps — release* again with a higher version (1.0.1, 1.1.0 …), then
  in App Store Connect create a new version and pick the new build; in Play
  Console create a new release with the new .aab.
- **Test builds**: every change to the app projects runs *Mobile apps — build
  check*; its Android run has a test APK you can install on an Android phone.
