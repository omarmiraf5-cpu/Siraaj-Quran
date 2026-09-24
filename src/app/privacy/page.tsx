import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { PRIVACY_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy — MyDiiwaan",
  description: "What MyDiiwaan collects, why, who can see it, and how to have it deleted.",
};

/*
 * Written to match what the portal actually does — check it against the
 * code before changing a claim. In particular: staff sign-in stores the
 * distance from school, never coordinates (api/staff-attendance); there are
 * no analytics or advertising SDKs; recitation audio and Mushaf fonts are
 * fetched by the device from the third-party hosts named below.
 */
export default function PrivacyPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <InfoPage title="Privacy policy" updated={PRIVACY_UPDATED}>
      <p>
        MyDiiwaan is a portal for Qur&apos;an schools: the office, teachers, parents and students each use it to
        follow lessons, attendance and progress. This policy explains what information MyDiiwaan holds, why, who
        can see it, and how to have it removed. It covers the website at mydiiwaan.com and the MyDiiwaan apps for
        iPhone, iPad and Android, which show the same portal.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Each school decides who has an account and what is recorded about its students. For those school records
        the school is responsible, and MyDiiwaan looks after them on the school&apos;s behalf. Questions about a
        child&apos;s record are best asked of the school first; you can also contact us at {email}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, your role (admin, teacher, parent or student), your school,
          and for staff and parents an email address and, if the school adds one, a phone number. Passwords are
          stored by our sign-in provider in a form no one at MyDiiwaan can read.
        </li>
        <li>
          <strong>Student records, entered by the school</strong> — a student&apos;s name, halaqa (class) and
          year; attendance; Qur&apos;an lessons and revision, the teacher&apos;s ratings and notes, memorisation
          progress and yearly plans; stars and badges; school fees owed and paid (amounts and dates only — no card
          or bank details); and messages between parents and teachers about the child.
        </li>
        <li>
          <strong>Staff sign-in</strong> — when a teacher signs in or out, the phone&apos;s location is checked
          against the school&apos;s location to confirm they are on the premises. We keep the time, the distance
          from the school and how precise the reading was — not the location itself. Location is only read at the
          moment of signing in or out, never in the background, and never for parents or students.
        </li>
        <li>
          <strong>The school&apos;s location</strong>, set by the school&apos;s admin for that check.
        </li>
        <li>
          <strong>Notices</strong> the portal sends — for example to parents and the office when a child has
          missed five school days in a row.
        </li>
        <li>
          <strong>On your device</strong> — a sign-in cookie that keeps you signed in, and settings such as your
          language, light or dark theme, and the school code used for student sign-in.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <p>
        There is no advertising in MyDiiwaan. We don&apos;t sell or rent anyone&apos;s information, we don&apos;t
        track you across other apps or websites, and the portal contains no advertising or analytics trackers.
      </p>

      <h2>How it is used</h2>
      <p>
        Only to run the portal for your school: showing each person what their role needs, working out lesson
        plans and attendance, and sending the notices described above. We may look at an account&apos;s data when
        the school or the account holder asks us for help, or to keep the service working and secure.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li>Staff at your school, according to their role — for example, teachers see their students&apos; work.</li>
        <li>Parents see their own children&apos;s records and messages. Students see their own work.</li>
        <li>No other school can see your school&apos;s information.</li>
        <li>
          Our service providers, only to run MyDiiwaan for us: Supabase (database and sign-in) and Vercel (hosting).
        </li>
        <li>
          When you play a recitation or open the Mushaf, your device fetches the audio from cdn.islamic.network or
          everyayah.com and the Mushaf fonts from cdn.jsdelivr.net. Those services see your device&apos;s internet
          address, as with any website, but nothing about your account.
        </li>
      </ul>
      <p>We only share information beyond this if the law requires it.</p>

      <h2>Children</h2>
      <p>
        Students are children. Their accounts are created by their school, they sign in with a PIN the school gives
        them, and MyDiiwaan only holds what the school records about them for their Qur&apos;an education. The
        school is responsible for having parents&apos; agreement to this, for example as part of enrolment. Parents
        can ask the school, or us at {email}, to see, correct or delete their child&apos;s information.
      </p>

      <h2>Keeping and deleting information</h2>
      <ul>
        <li>Information is kept while your school uses MyDiiwaan.</li>
        <li>
          You can delete your account at any time from the <Link href="/account">Account</Link> page in the portal
          or the app. That removes your login and your details. Records you made about students — attendance
          taken, lessons set, messages in a child&apos;s thread — belong to the school and stay, without your name.
        </li>
        <li>
          A student can ask their school to delete their account from the same page, and a school&apos;s admin can
          delete a student&apos;s record permanently.
        </li>
        <li>When a school closes its account, its information and every account in it are deleted.</li>
        <li>Deleted information may remain in encrypted backups for a short time until they are replaced.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Everything is sent over encrypted connections. Each school&apos;s records are separated from every other
        school&apos;s, and each person can only reach what their role allows. Yearly plans are additionally
        encrypted before they are stored.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete your information, or ask a question about this policy, by contacting
        your school or emailing {email}. You can turn off location for MyDiiwaan in your phone&apos;s settings at any
        time; staff sign-in will then ask for it again.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the new version will be posted here with a new date. Significant changes will be
        announced in the portal.
      </p>

      <p className="text-ink-muted">
        Contact: {email} · <Link href="/support">Help and support</Link>
      </p>
    </InfoPage>
  );
}
