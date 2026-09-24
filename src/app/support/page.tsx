import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help and support — MyDiiwaan",
  description: "Answers to common questions about MyDiiwaan, and how to contact us.",
};

export default function SupportPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <InfoPage title="Help and support">
      <p>
        Most questions are quickest answered by your school&apos;s office, who set up your account. For anything
        else, email {email} — include your school&apos;s name and what you were trying to do, and we&apos;ll get back
        to you, in sha Allah, within two working days.
      </p>

      <h2>I forgot my password</h2>
      <p>
        Ask your school&apos;s office. They can give you a new temporary password, and you&apos;ll choose your own the
        next time you sign in.
      </p>

      <h2>A student can&apos;t sign in</h2>
      <p>
        On the sign-in screen, choose <strong>Student</strong>, type the school code (your teacher has it, and
        admins see it on the Students page), tap your name and enter your 4-digit PIN. If the PIN doesn&apos;t work,
        your teacher or the office can set a new one.
      </p>

      <h2>Staff sign-in says I&apos;m not at school</h2>
      <p>
        Signing in only works on the school premises. Make sure location is allowed for MyDiiwaan (in your
        phone&apos;s Settings), wait a moment for a precise reading — near a window helps — and try again. If the
        school&apos;s location is set wrongly, the admin can correct it on the Staff attendance page.
      </p>

      <h2>I don&apos;t see my child</h2>
      <p>Ask the school office to link your child to your parent account.</p>

      <h2>Deleting your account</h2>
      <p>
        Open <Link href="/account">Account</Link> (in the menu, or tap your picture on a student&apos;s home screen)
        and choose <strong>Delete account</strong>. What that removes is explained there and in the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Reporting a problem</h2>
      <p>
        Email {email} with your school&apos;s name, what happened, and — if you can — a screenshot. Please
        don&apos;t send passwords or PINs.
      </p>
    </InfoPage>
  );
}
