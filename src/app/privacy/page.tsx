import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { PRIVACY_UPDATED, PRIVACY_UPDATED_AR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy — MyDiiwaan",
  description: "What MyDiiwaan collects, why, who can see it, and how to have it deleted.",
};

/*
 * Written to match what the portal actually does — check it against the
 * code before changing a claim. In particular: staff sign-in stores the
 * distance from school, never coordinates (api/staff-attendance); there are
 * no analytics or advertising SDKs; recitation audio and Mushaf fonts are
 * fetched by the device from the third-party hosts named below; uploaded
 * spreadsheets are read in memory (api/onboard/parse-roster) and not kept.
 */
export default function PrivacyPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <InfoPage
      title="Privacy policy"
      updated={PRIVACY_UPDATED}
      arabic={{ title: "سياسة الخصوصية", updated: PRIVACY_UPDATED_AR, body: <PrivacyArabic email={email} /> }}
    >
      <p>
        MyDiiwaan is a portal for Qur&apos;an schools: the office, teachers, parents and students each use it to
        follow lessons, attendance and progress. This policy explains what information MyDiiwaan holds, why, who
        can see it, and how to have it removed. It covers the website at www.mydiiwaan.com and the MyDiiwaan apps for
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
          <strong>Student records, entered by the school</strong> — a student&apos;s name, halaqa (class), grade and
          campus; attendance; Qur&apos;an and Qa&apos;idah lessons and revision, the teacher&apos;s ratings and notes,
          memorisation progress and yearly plans; Islamic Studies and Arabic work and marks; stars and badges; school
          fees owed and paid (amounts and dates only — no card or bank details); and messages between parents and
          teachers about the child.
        </li>
        <li>
          <strong>Student sign-in</strong> — the 4-digit PIN the school sets, which the office can read back to a
          child who forgets it, and a count of wrong PINs: after five in a row, that child&apos;s PIN is refused for
          15 minutes.
        </li>
        <li>
          <strong>The school&apos;s own finances</strong>, if it uses them — what it pays its staff each month and
          what it spends. Only the school&apos;s admins can see these.
        </li>
        <li>
          <strong>Lesson recordings</strong> — audio a teacher records of Qa&apos;idah lessons, for the school&apos;s
          students to listen to. Stored for the school and played only to its signed-in members.
        </li>
        <li>
          <strong>Spreadsheets</strong> the office uploads to add students or parents are read to take out the names
          and details, and are not kept.
        </li>
        <li>
          <strong>Teachers at more than one school</strong> — a teacher can belong to several schools with one login.
          Each school sees the teacher&apos;s name and email, and only its own records.
        </li>
        <li>
          <strong>Agreements</strong> — when a school&apos;s admin accepted our <Link href="/terms">terms</Link> and
          confirmed the school has parents&apos; agreement, and who did.
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
          <strong>Notices and emails</strong> the portal sends — for example to parents and the office when a child
          has missed five school days in a row; a welcome or password-reset email; and, if the school uses them, a
          Friday email to parents about their child&apos;s week. Every Friday email has a link to unsubscribe, and
          parents can also turn them off on their Account page.
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
          Our service providers, only to run MyDiiwaan for us: Supabase (database, file storage and sign-in), Vercel
          (hosting), Resend (sending emails — it receives the recipient&apos;s address and the email&apos;s
          contents) and Cloudflare (which runs the mydiiwaan.com domain name).
        </li>
        <li>
          When an admin sets the school&apos;s location, the map is drawn from OpenStreetMap and the address typed is
          looked up with OpenStreetMap&apos;s search service. They see the address searched for and your
          device&apos;s internet address, nothing about your account.
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
          When a student has been inactive for over two years, the school is offered to delete their records for
          good from its Students page.
        </li>
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
        school&apos;s, and each person can only reach what their role allows — a student&apos;s login can&apos;t
        open a teacher&apos;s or a parent&apos;s pages, and only staff can change the school&apos;s records. Yearly
        plans are additionally encrypted before they are stored. If a breach ever affected a school&apos;s records,
        we would tell the school without undue delay and help it tell the people affected.
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
        Contact: {email} · <Link href="/terms">Terms of Service</Link> · <Link href="/support">Help and support</Link>
      </p>
    </InfoPage>
  );
}

// The Arabic text follows the English one paragraph for paragraph; change
// both together.
function PrivacyArabic({ email }: { email: React.ReactNode }) {
  return (
    <>
      <p className="text-ink-muted">
        هذه ترجمة عربية للتيسير، وعند أي اختلاف بينها وبين النص الإنجليزي يُعتمد النص الإنجليزي.
      </p>
      <p>
        MyDiiwaan بوابة لمدارس القرآن، يستخدمها المكتب والمعلمون وأولياء الأمور والطلاب لمتابعة الدروس والحضور
        والتقدّم. وتوضّح هذه السياسة المعلومات التي يحتفظ بها MyDiiwaan، وسبب ذلك، ومن يستطيع الاطلاع عليها، وكيف تُحذف.
        وتشمل موقع www.mydiiwaan.com وتطبيقات MyDiiwaan على iPhone وiPad وAndroid، التي تعرض البوابة نفسها.
      </p>

      <h2>الجهة المسؤولة</h2>
      <p>
        كل مدرسة تقرر من يُمنح حسابًا وما يُسجَّل عن طلابها. فالمدرسة مسؤولة عن سجلاتها، وMyDiiwaan يحفظها نيابةً عنها.
        والأفضل أن تُوجَّه الأسئلة المتعلقة بسجل الطفل إلى المدرسة أولًا، ويمكنك أيضًا مراسلتنا على {email}.
      </p>

      <h2>ما نجمعه</h2>
      <ul>
        <li>
          <strong>بيانات الحساب</strong> — اسمك ودورك (مدير أو معلم أو ولي أمر أو طالب) ومدرستك، وللموظفين وأولياء
          الأمور بريد إلكتروني، ورقم هاتف إن أضافته المدرسة. أما كلمات المرور فيحفظها مزوّد خدمة الدخول بصيغة لا يستطيع
          أحد في MyDiiwaan قراءتها.
        </li>
        <li>
          <strong>سجلات الطلاب التي تُدخلها المدرسة</strong> — اسم الطالب وحلقته (فصله) وصفّه وفرعه، والحضور، ودروس
          القرآن والقاعدة والمراجعة، وتقييمات المعلم وملاحظاته، وتقدّم الحفظ والخطط السنوية، وأعمال التربية الإسلامية
          واللغة العربية ودرجاتها، والنجوم والأوسمة، والرسوم المستحقة والمدفوعة (المبالغ والتواريخ فقط — دون أي بيانات
          بطاقات أو حسابات بنكية)، والرسائل المتبادلة بين أولياء الأمور والمعلمين عن الطفل.
        </li>
        <li>
          <strong>دخول الطلاب</strong> — الرقم السري المكوّن من 4 أرقام الذي تحدده المدرسة، ويستطيع المكتب قراءته
          للطفل إذا نسيه، وعدد المحاولات الخاطئة: فبعد خمس محاولات خاطئة متتالية يُرفض الرقم السري لذلك الطفل لمدة 15 دقيقة.
        </li>
        <li>
          <strong>الشؤون المالية للمدرسة</strong>، إن استخدمتها — ما تدفعه لموظفيها كل شهر وما تنفقه. ولا يطّلع عليها
          إلا مديرو المدرسة.
        </li>
        <li>
          <strong>تسجيلات الدروس</strong> — مقاطع صوتية يسجّلها المعلم لدروس القاعدة ليستمع إليها طلاب المدرسة. تُحفظ
          للمدرسة ولا تُشغَّل إلا لأعضائها المسجّلين.
        </li>
        <li>
          <strong>جداول البيانات</strong> التي يرفعها المكتب لإضافة الطلاب أو أولياء الأمور، تُقرأ لاستخراج الأسماء
          والبيانات منها، ولا يُحتفظ بها.
        </li>
        <li>
          <strong>المعلمون في أكثر من مدرسة</strong> — يمكن للمعلم أن ينتمي إلى عدة مدارس بحساب واحد، وترى كل مدرسة اسمه
          وبريده الإلكتروني، ولا ترى إلا سجلاتها.
        </li>
        <li>
          <strong>الموافقات</strong> — متى قبل مدير المدرسة <Link href="/terms">شروطنا</Link> وأكّد أن لدى المدرسة موافقة
          أولياء الأمور، ومن قام بذلك.
        </li>
        <li>
          <strong>تسجيل حضور الموظفين</strong> — عند تسجيل المعلم دخوله أو خروجه، يُقارَن موقع الهاتف بموقع المدرسة
          للتأكد من وجوده فيها. ونحتفظ بالوقت والمسافة عن المدرسة ومدى دقة القراءة — لا بالموقع نفسه. ولا يُقرأ الموقع
          إلا لحظة تسجيل الدخول أو الخروج، ولا يُقرأ أبدًا في الخلفية، ولا يُطلب من أولياء الأمور أو الطلاب.
        </li>
        <li>
          <strong>موقع المدرسة</strong>، الذي يحدده مديرها لهذا التحقق.
        </li>
        <li>
          <strong>الإشعارات والرسائل الإلكترونية</strong> التي ترسلها البوابة — مثل إشعار أولياء الأمور والمكتب حين يغيب
          الطفل خمسة أيام دراسية متتالية، ورسالة الترحيب أو إعادة تعيين كلمة المرور، ورسالة يوم الجمعة إلى أولياء
          الأمور عن أسبوع أبنائهم إن كانت المدرسة تستخدمها. وكل رسالة جمعة فيها رابط لإلغاء الاشتراك، ويستطيع أولياء
          الأمور أيضًا إيقافها من صفحة الحساب.
        </li>
        <li>
          <strong>على جهازك</strong> — ملف تعريف ارتباط (كوكي) يُبقيك مسجّل الدخول، وإعدادات مثل لغتك، والوضع الفاتح أو
          الداكن، ورمز المدرسة المستخدم لدخول الطلاب.
        </li>
      </ul>

      <h2>ما لا نفعله</h2>
      <p>
        لا إعلانات في MyDiiwaan. ولا نبيع معلومات أحد ولا نؤجرها، ولا نتتبعك عبر التطبيقات أو المواقع الأخرى، ولا تحتوي
        البوابة على أي أدوات إعلانية أو تحليلية للتتبع.
      </p>

      <h2>كيف نستخدمها</h2>
      <p>
        لتشغيل البوابة لمدرستك فقط: عرض ما يحتاجه كل شخص بحسب دوره، وحساب الخطط الدراسية والحضور، وإرسال الإشعارات
        المذكورة أعلاه. وقد نطّلع على بيانات حساب ما إذا طلبت المدرسة أو صاحب الحساب مساعدتنا، أو لإبقاء الخدمة تعمل
        بأمان.
      </p>

      <h2>من يستطيع الاطلاع عليها</h2>
      <ul>
        <li>موظفو مدرستك، بحسب أدوارهم — فالمعلمون مثلًا يرون أعمال طلابهم.</li>
        <li>يرى أولياء الأمور سجلات أبنائهم ورسائلهم فقط، ويرى الطلاب أعمالهم فقط.</li>
        <li>لا تستطيع أي مدرسة أخرى الاطلاع على معلومات مدرستك.</li>
        <li>
          مزوّدو الخدمة لدينا، لتشغيل MyDiiwaan فقط: Supabase (قاعدة البيانات وتخزين الملفات وتسجيل الدخول)، وVercel
          (الاستضافة)، وResend (إرسال الرسائل الإلكترونية — ويتلقى عنوان المستلم ومحتوى الرسالة)، وCloudflare (التي
          تدير نطاق mydiiwaan.com).
        </li>
        <li>
          عندما يحدد المدير موقع المدرسة، تُرسم الخريطة من OpenStreetMap، ويُبحث عن العنوان المكتوب بخدمة البحث في
          OpenStreetMap. ويرون العنوان الذي بُحث عنه وعنوان الإنترنت لجهازك، ولا شيء عن حسابك.
        </li>
        <li>
          عند تشغيل تلاوة أو فتح المصحف، يجلب جهازك الصوت من cdn.islamic.network أو everyayah.com، وخطوط المصحف من
          cdn.jsdelivr.net. وترى هذه الخدمات عنوان الإنترنت لجهازك، كما هو الحال مع أي موقع، ولا شيء عن حسابك.
        </li>
      </ul>
      <p>ولا نشارك المعلومات خارج هذا النطاق إلا إذا اقتضى القانون ذلك.</p>

      <h2>الأطفال</h2>
      <p>
        الطلاب أطفال، تنشئ مدارسهم حساباتهم، ويدخلون برقم سري تعطيهم إياه المدرسة، ولا يحتفظ MyDiiwaan إلا بما تسجّله
        المدرسة عنهم لتعليمهم القرآن. والمدرسة مسؤولة عن الحصول على موافقة أولياء الأمور على ذلك، كأن يكون ضمن إجراءات
        التسجيل. ولأولياء الأمور أن يطلبوا من المدرسة، أو منا على {email}، الاطلاع على معلومات أبنائهم أو تصحيحها أو
        حذفها.
      </p>

      <h2>حفظ المعلومات وحذفها</h2>
      <ul>
        <li>تُحفظ المعلومات ما دامت مدرستك تستخدم MyDiiwaan.</li>
        <li>إذا ظل الطالب غير نشط لأكثر من سنتين، تُعرض على المدرسة إمكانية حذف سجلاته نهائيًا من صفحة الطلاب.</li>
        <li>
          يمكنك حذف حسابك في أي وقت من صفحة <Link href="/account">الحساب</Link> في البوابة أو التطبيق، فيُحذف حساب
          دخولك وبياناتك. أما ما سجّلته عن الطلاب — من حضور ودروس ورسائل في محادثة الطفل — فهو ملك للمدرسة ويبقى، دون
          اسمك.
        </li>
        <li>يمكن للطالب أن يطلب من مدرسته حذف حسابه من الصفحة نفسها، ولمدير المدرسة أن يحذف سجل الطالب نهائيًا.</li>
        <li>عند إغلاق المدرسة حسابها، تُحذف معلوماتها وجميع الحسابات التابعة لها.</li>
        <li>قد تبقى المعلومات المحذوفة في النسخ الاحتياطية المشفّرة فترة قصيرة إلى أن تُستبدل.</li>
      </ul>

      <h2>الأمان</h2>
      <p>
        كل البيانات تُنقل عبر اتصالات مشفّرة، وسجلات كل مدرسة مفصولة عن سجلات غيرها، ولا يصل كل شخص إلا إلى ما يسمح به
        دوره — فحساب الطالب لا يفتح صفحات المعلم أو ولي الأمر، ولا يغيّر سجلات المدرسة إلا موظفوها. وتُشفَّر الخطط
        السنوية أيضًا قبل حفظها. وإذا حدث اختراق يمس سجلات مدرسة ما، فسنُبلغها دون تأخير غير مبرر ونساعدها على إبلاغ
        المتأثرين.
      </p>

      <h2>خياراتك</h2>
      <p>
        يمكنك طلب الاطلاع على معلوماتك أو تصحيحها أو حذفها، أو السؤال عن هذه السياسة، بالتواصل مع مدرستك أو مراسلتنا
        على {email}. ويمكنك إيقاف الوصول إلى الموقع لتطبيق MyDiiwaan من إعدادات هاتفك في أي وقت، وسيطلبه تسجيل حضور
        الموظفين مرة أخرى.
      </p>

      <h2>التغييرات</h2>
      <p>
        إذا تغيرت هذه السياسة، فستُنشر النسخة الجديدة هنا بتاريخ جديد، وسيُعلن عن التغييرات المهمة في البوابة.
      </p>

      <p className="text-ink-muted">
        للتواصل: {email} · <Link href="/terms">شروط الخدمة</Link> · <Link href="/support">المساعدة والدعم</Link>
      </p>
    </>
  );
}
