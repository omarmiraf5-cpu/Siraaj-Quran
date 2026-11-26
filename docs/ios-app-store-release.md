# Putting MyDiiwaan on the App Store

This is the list of things only you can do. You do not need a Mac. The iPhone
app is already set up in this project:

- Name on the home screen: **MyDiiwaan**
- Apple's id for the app (the bundle id): **com.mydiiwaan.app** — do not change it
- Version people see: **1.0.0**
- Build number stored in the project: **1** (the cloud build picks the next TestFlight number itself)
- Oldest iPhone system: **iOS 15**
- Your Apple team is already filled in: **T6L2L5B4QH** (an individual membership)
- Signing is automatic

The app opens **https://www.mydiiwaan.com**. A change to the website shows up
in the app immediately. You only upload a new build when something in the
phone shell changes (the icon, the permissions, or a phone feature).

The upload workflow does **not** send the app to Apple's reviewers. You press
that button yourself, after you have installed the TestFlight build and filled
in the store page.

---

## What you still have to do

1. Keep the Apple Developer membership paid ($99 a year). You already have an individual team.
2. Create an App Store Connect API key and save four secrets in GitHub (section 2).
3. Give GitHub the existing distribution certificate, id **M6TPLDDU24**, or create one new certificate once if that file is lost (section 2).
4. Run **Actions → iOS → TestFlight**. First time, you can run it as "register" and then as "testflight".
5. Create a review school and write down the logins (section 4). Signing in must work from anywhere. The location check must not be the front door.
6. Fill in the App Store page, the privacy form, and the screenshots (sections 3 and 5). Text to paste is in `store/ios/`.
7. Install the build on your own iPhone with the TestFlight app and try it.
8. Only then, in App Store Connect, press **Add for Review** and **Submit**. Nothing in this project does that for you.

---

## 1. Apple Developer Program

The program costs **$99 US a year**. It is what lets you put an app on the
App Store.

You already have an **individual** membership. The team id in the project is
**T6L2L5B4QH**. An individual membership shows your personal legal name as the
seller. You do **not** need a D-U-N-S number for that.

Two kinds of account:

- **Individual.** Your own name. Enrolling is the short path. No D-U-N-S number. This is the account the project is set up for.
- **Organization.** The company's name is the seller. Apple asks for a **D-U-N-S number**, which is a free business id from Dun & Bradstreet. Getting that number, and Apple's check that you can sign for the company, takes longer than an individual account (often a few days, sometimes a few weeks). You would only switch to this if you want the store to say a company name instead of your name. Switching later means a new team id, and the project would have to be changed. Stay on the individual team for this first release.

If the membership has lapsed, renew it at
[developer.apple.com/programs](https://developer.apple.com/programs/) with the
same Apple ID. Do not start a second account.

When the membership is active, open
[appstoreconnect.apple.com](https://appstoreconnect.apple.com). The cloud
build can create the app record for you (section 2). If you would rather
create it yourself: **Apps → + → New App**.

- Platform: iOS
- Name: `MyDiiwaan` (if Apple says that name is taken: `MyDiiwaan – Qur'an School`)
- Primary language: English
- Bundle ID: `com.mydiiwaan.app`
- SKU: `mydiiwaan-ios` (a private id for your records, not shown on the store)
- User access: Full access

---

## 2. Build in the cloud (no Mac)

GitHub builds the app on a Mac that Apple's cloud provides, then uploads it
to TestFlight. You stay in the browser.

### The six secrets

On the project's GitHub page: **Settings → Secrets and variables → Actions →
New repository secret**. Add these. GitHub will not show them again after you
save, and they are not written into the code.

| Secret name | What to paste |
|---|---|
| `APPLE_TEAM_ID` | `T6L2L5B4QH` |
| `ASC_KEY_ID` | the Key ID from the API key below |
| `ASC_ISSUER_ID` | the Issuer ID above the list of keys |
| `ASC_KEY_P8_BASE64` | the downloaded key file, turned into one line of base64 |
| `IOS_DIST_CERT_P12_BASE64` | the distribution certificate `.p12`, as base64 |
| `IOS_DIST_CERT_PASSWORD` | the password you chose when you exported that `.p12` |

The API key:

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+**.
2. Name: `GitHub builds`. Access: **Admin**. Generate.
3. Download the file `AuthKey_XXXXXXXX.p8`. Apple lets you download it **once**. Keep a copy in a password manager or an encrypted drive.
4. Write down the **Key ID** and the **Issuer ID**.
5. Turn the file into base64. On any computer with a terminal:

```
base64 -i AuthKey_XXXXXXXX.p8
```

On Windows, in PowerShell:

```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXX.p8"))
```

Paste the whole result into `ASC_KEY_P8_BASE64`. The key must be **Admin**.
A weaker key cannot register the app id or upload.

### The certificate you already have

Apple identifies you as the publisher with a **distribution certificate**.
The team already has one. Its id is **M6TPLDDU24**. Apple only lets an account
hold a few of these, so the build must reuse it. Reusing it needs the
certificate's private key, which is a `.p12` file.

Apple's website cannot download that private key again. It only exists on the
Mac that created the certificate, or in a `.p12` someone exported from that Mac.

- If you have that Mac, or a backup of the `.p12`: open **Keychain Access**,
  find the certificate named **Apple Distribution** (it should mention
  M6TPLDDU24 or your name and team T6L2L5B4QH), and choose **Export**. Pick a
  long password and store it in a password manager. That password is
  `IOS_DIST_CERT_PASSWORD`. Base64 the `.p12` the same way as the API key,
  and paste it into `IOS_DIST_CERT_P12_BASE64`.
- If that Mac is gone and nobody has the `.p12`, the old certificate cannot
  be reused. A new one is unavoidable. Run the workflow **once** with
  **allow a new distribution certificate** turned on (see below). When it
  finishes, download the file attached to the run (`new-distribution-certificate`).
  The job summary shows the password. Put the `.p12` into
  `IOS_DIST_CERT_P12_BASE64` and the password into `IOS_DIST_CERT_PASSWORD`.
  Delete the attachment from the run. Leave the switch **off** after that.
  If Apple says the account already has the maximum number of certificates,
  open [developer.apple.com](https://developer.apple.com) → **Certificates**,
  revoke a certificate whose `.p12` you do not have, and run once more.
  Revoking does not remove an app that is already on people's phones. It only
  stops that certificate from signing new uploads.

Do not email the `.p12` or the `.p8` without a password, and do not commit
them to GitHub.

### Run the build

GitHub → **Actions** → **iOS → TestFlight** → **Run workflow**.

- **task:** `testflight` (this also creates the app record if it is missing).
  Use `register` first only if you want the App Store Connect record created
  before you have the certificate.
- **version:** `1.0.0` until you decide the public version should change.
- **allow a new distribution certificate:** leave this **off**, unless you
  are in the "the .p12 is lost" case above.

The build takes roughly 20–40 minutes. It does not compile the website. It
prepares the phone shell, signs it, and uploads it. The build number is one
higher than the newest build already on TestFlight, so you never type it.

When it is green, wait in App Store Connect → your app → **TestFlight**.
Apple processes the file for about 10–30 minutes. Install Apple's
**TestFlight** app on your iPhone, and add yourself under **Internal Testing**
if you are not already there. Open the app, sign in, and try the teacher,
parent, and student paths in section 4.

Nothing in this run submits the app for review.

The `register` task (and the start of `testflight`) creates the bundle id
`com.mydiiwaan.app` and the App Store Connect app **MyDiiwaan** (primary
language English, SKU `mydiiwaan-ios`) when they are missing. It uses the
API key above. Fastlane's usual `produce` command cannot do this in the
cloud: the version this project pins still asks for an Apple ID password,
even if you pass it an API key. The lane therefore calls the same App Store
Connect API directly. It does not submit the app for review.

If the name **MyDiiwaan** is already taken on the App Store, the register
step fails. Create the record by hand with the longer name
`MyDiiwaan – Qur'an School`, same bundle id and SKU, and run `testflight`
again. If Apple asks for a company name, use your legal name (this is an
individual team) on that same form.

### If you later have a Mac

You do not need this for the first upload.

1. Install **Xcode** from the Mac App Store and open it once.
2. In this project folder, run `npx cap sync ios`.
3. Open `ios/App/App.xcworkspace` (double-click it). The team
   **T6L2L5B4QH** and automatic signing are already set. In **Signing &
   Capabilities**, confirm the team is yours and the bundle id is
   `com.mydiiwaan.app`. Version **1.0.0**, build **1** in the project; each
   upload still needs a higher build number.
4. At the top, choose **Any iOS Device (arm64)**, not a simulator.
5. Menu **Product → Archive**.
6. **Distribute App → App Store Connect → Upload**. Leave the defaults
   (automatic signing, upload symbols). Do not choose a button that says
   submit for review.

A rented Mac (MacinCloud, or an Amazon Mac) can do the same clicks. Codemagic
or Xcode Cloud can also build the project. Prefer the GitHub workflow above
so you do not create a second certificate by accident. Use one path for a
given upload.

---

## 3. The App Store page

In App Store Connect, open the app → the version **1.0 Prepare for Submission**.

Paste the text from `store/ios/listing.md`.

- **Name:** MyDiiwaan
- **Subtitle:** Qur'an school portal
- **Category:** Education. Secondary category: Productivity
- **Price:** Free
- **Privacy Policy URL:** https://www.mydiiwaan.com/privacy
- **Support URL:** https://www.mydiiwaan.com/support
- **Marketing URL:** https://www.mydiiwaan.com
- **Copyright:** your legal name, or the school's legal name, and the year

**Age rating.** Fill in Apple's questionnaire from what the app actually does.
There is no violence, horror, gambling, or unrestricted web browser. People
in the same school can message each other (a parent and a teacher). Students
are children, and the school creates their accounts. The app is for the whole
school, including adults, so the category stays **Education**. Do not also
mark it as a kids-only app unless you mean to accept Apple's extra kids-app
rules. Apple chooses the age number from your answers.

**Content rights.** The app plays Qur'an audio from islamic.network and
everyayah.com, and shows Mushaf fonts from jsDelivr. Answer **Yes**, it
contains third-party content, only if you are satisfied you have the right to
use that audio and those fonts.

**Encryption.** The app only uses ordinary secure web connections (HTTPS).
Answer **No** to the question about non-exempt encryption. The project
already tells Apple this, so the upload usually does not ask again.

**App Privacy.** Privacy Policy URL: https://www.mydiiwaan.com/privacy

You do collect data. You do not track people across other companies' apps.
Do not tick Tracking. There is no analytics. The answers must match
`store/ios/privacy-answers.md`, which matches the privacy manifest in the app.

Choose the build from TestFlight when you are ready. Do not submit yet. Finish
sections 4 and 5 first, and try the app yourself.

---

## 4. Review notes and the demo school

Apple signs in and clicks around. On your `/platform` page, create a school
just for them, the same way you would for a Play review school. Call it
**MyDiiwaan Review School**, with:

- you, or a spare admin, as the admin
- one teacher
- one parent, linked to a child
- one student with a 4-digit PIN, and the school's code

Write the emails, passwords, school code, and PIN in a password manager. You
will paste them into App Store Connect. Do **not** send Apple the sample
logins from the README (`admin@mydiiwaan.com` / `admin123` and the others).
Those are a demo switch, not this school.

### The location check must not block the reviewer

Signing in with an email and password does **not** look at the phone's
location. A reviewer in California can open the admin, teacher, and parent
pages with the passwords you send. A student signs in with the school code,
their name, and the PIN, and is never asked for location.

Location is used in one place only: when a **teacher taps Sign in or Sign
out** on the attendance card, to check they are at the school. A reviewer who
taps that button will be told they are not on the premises. That message is
the feature working. It is not a broken login, and it must not be the only
way into the app.

The furthest the portal can set that circle is 2 km, which still does not
cover Apple's office. Do not count on the circle. Do not turn the check off
for your real schools.

In App Store Connect → **App Review Information**:

- Sign-in required: **Yes**
- Username and password: the **teacher** email and password
- Notes: paste `store/ios/review-notes.md` with the blanks filled in

That note tells Apple to use the passwords to get in, and not to treat the
"not at the school" message as a bug.

Account deletion, which Apple checks for: menu → **Account** → **Delete
account**. Ask them to try that on a spare account, not the teacher login.

---

## 5. Screenshots, and iPad

The app **supports iPad**. From tablet width upward the site shows the same
sidebar it uses on a desktop, which is a real layout, not a stretched phone
picture. iPhone-only would leave iPad users with a small phone window. Keep
iPad turned on. Because it is on, Apple requires iPad screenshots as well as
iPhone ones.

Portrait screenshots. At least three, and up to ten, for each size. Capture
the sign-in screen, a teacher's day, the Mushaf, and a parent's view. Take
the signed-in ones on a phone or in TestFlight after the review school
exists.

A starting set of the **public sign-in screen only** was taken from the live
site (Parent, Teacher, Student, and Admin). The iPhone pictures are
1320 × 2868. Two iPad pictures of the same page (Parent and Teacher) are
2064 × 2752. They are attached to the pull request that added this checklist.
They are not a substitute for the signed-in screens, and they are not in the
git history.

| Slot | Size in pixels | Required? |
|---|---|---|
| iPhone 6.9-inch | 1320 × 2868 (also accepted: 1290 × 2796, 1260 × 2736) | Yes |
| iPhone 6.5-inch | 1284 × 2778 or 1242 × 2688 | Only if the form still asks. After you upload the 6.9-inch set, use the option to reuse it for the smaller iPhones when App Store Connect offers that. |
| iPad 13-inch | 2064 × 2752 or 2048 × 2732 | Yes, because iPad is supported |

---

## 6. If Apple says the app is "just a website" (guideline 4.2)

The app is the school portal in a native shell, which Apple sometimes
rejects. These phone behaviours are already in this version. You can reply
with:

> MyDiiwaan is the companion app for schools that already use the MyDiiwaan
> portal. It is not a general web browser. Only mydiiwaan.com stays inside
> the app. Other links, such as WhatsApp, email, and a school's own website,
> open in Safari. The app adds native behaviour the site in Safari does not:
> a location check, through the iPhone's own location permission, so staff
> attendance sign-in can confirm they are at the school; a branded launch
> screen; a native offline screen in English, Somali, and Arabic when the
> phone has no connection, plus a local offline page when the site cannot be
> reached; pull-to-refresh; swipe-back; and status-bar styling matched to the
> app. Accounts are issued by the school. Location is requested only when a
> teacher taps Sign in or Sign out, never in the background, and never for
> students or parents. Opening the app and signing in do not require location.

Push notifications are not in version 1.0, on purpose. The app does not ask
for notification permission. If Apple still wants more after this reply, an
absence alert would be the next feature, and it would need a new build.

Universal links (tapping a mydiiwaan.com link on the phone and landing in the
app) are not set up. They need a small file published on the website that
names this team id. The app already keeps the portal inside itself, so they
are not part of this submission.

---

## 7. What not to put in GitHub

- The `.p8` API key, or the `.p12` certificate, except as GitHub secrets
- Apple provisioning profiles
- Passwords for the review school

---

## 8. After it is live

Website changes show up in the app on their own. For a new phone version,
run **iOS → TestFlight** again. Raise the version in the form (1.0.1, 1.1.0,
…) when you want the public version to change. The build number goes up by
itself. Then, in App Store Connect, create the new version and attach the
build. Submitting for review is still a button you press yourself.
