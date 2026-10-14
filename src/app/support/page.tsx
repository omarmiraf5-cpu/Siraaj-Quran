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
    <InfoPage title="Help and support" arabic={{ title: "المساعدة والدعم", body: <SupportArabic email={email} /> }}>
      <p>
        Most questions are quickest answered by your school&apos;s office, who set up your account. For anything
        else, email {email} — include your school&apos;s name and what you were trying to do, and we&apos;ll get back
        to you, in sha Allah, within two working days.
      </p>

      <h2>I forgot my password</h2>
      <p>
        On the sign-in screen, tap <Link href="/forgot-password">Forgot your password?</Link> and enter the email you
        sign in with. We&apos;ll email you a link to choose a new one. It can take a minute, so check your spam folder
        too. Your school&apos;s office can also give you a new temporary password.
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

function SupportArabic({ email }: { email: React.ReactNode }) {
  return (
    <>
      <p>
        أسرع طريق للإجابة عن أغلب الأسئلة هو مكتب مدرستك، فهو الذي أنشأ حسابك. ولأي أمر آخر راسلنا على {email}، واذكر
        اسم مدرستك وما كنت تحاول القيام به، وسنرد عليك إن شاء الله خلال يومَي عمل.
      </p>

      <h2>نسيت كلمة المرور</h2>
      <p>
        في شاشة الدخول اضغط <Link href="/forgot-password">نسيت كلمة المرور؟</Link> وأدخل البريد الإلكتروني الذي تدخل
        به، وسنرسل إليك رابطًا لاختيار كلمة مرور جديدة. قد يستغرق ذلك دقيقة، فتفقّد مجلد الرسائل غير المرغوب فيها
        أيضًا. ويمكن لمكتب المدرسة كذلك أن يعطيك كلمة مرور مؤقتة جديدة.
      </p>

      <h2>الطالب لا يستطيع الدخول</h2>
      <p>
        في شاشة الدخول اختر <strong>طالب</strong>، ثم اكتب رمز المدرسة (تجده عند المعلم، ويراه المديرون في صفحة
        الطلاب)، ثم اضغط على اسمك وأدخل رقمك السري المكوّن من 4 أرقام. وإن لم يعمل الرقم، فبإمكان المعلم أو المكتب
        تعيين رقم جديد.
      </p>

      <h2>تسجيل حضور الموظفين يقول إنني لست في المدرسة</h2>
      <p>
        لا يتم تسجيل الحضور إلا داخل مبنى المدرسة. تأكّد من السماح لتطبيق MyDiiwaan بالوصول إلى الموقع (من إعدادات
        هاتفك)، وانتظر لحظة حتى تتحدد القراءة بدقة — والوقوف قرب نافذة يساعد — ثم حاول مرة أخرى. وإن كان موقع
        المدرسة مضبوطًا بشكل خاطئ، فبإمكان المدير تصحيحه من صفحة حضور الموظفين.
      </p>

      <h2>لا أرى ابني أو ابنتي</h2>
      <p>اطلب من مكتب المدرسة ربط طفلك بحساب ولي الأمر الخاص بك.</p>

      <h2>حذف حسابك</h2>
      <p>
        افتح صفحة <Link href="/account">الحساب</Link> (من القائمة، أو بالضغط على صورتك في الصفحة الرئيسية للطالب)
        واختر <strong>حذف الحساب</strong>. وما يترتب على ذلك موضّح هناك وفي{" "}
        <Link href="/privacy">سياسة الخصوصية</Link>.
      </p>

      <h2>الإبلاغ عن مشكلة</h2>
      <p>
        راسلنا على {email} واذكر اسم مدرستك وما حدث، وأرفق لقطة شاشة إن أمكن. ونرجو ألا ترسل كلمات المرور أو
        الأرقام السرية.
      </p>
    </>
  );
}
