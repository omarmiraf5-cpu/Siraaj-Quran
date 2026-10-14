import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { SUPPORT_EMAIL, TERMS_UPDATED, TERMS_UPDATED_AR } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service — MyDiiwaan",
  description: "The terms for using MyDiiwaan, and the agreement between MyDiiwaan and each school about its records.",
};

/*
 * Plain-language terms. Part 2 is what a school's admin accepts for the
 * school (recorded with TERMS_VERSION). Have a lawyer review before relying
 * on it, and bump TERMS_VERSION in lib/site.ts when a change needs schools
 * to accept it again.
 */
export default function TermsPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
  return (
    <InfoPage
      title="Terms of Service"
      updated={TERMS_UPDATED}
      arabic={{ title: "شروط الخدمة", updated: TERMS_UPDATED_AR, body: <TermsArabic email={email} /> }}
    >
      <p>
        MyDiiwaan is a portal for Qur&apos;an and Islamic schools. These terms are in two parts: <strong>Part 1</strong>{" "}
        applies to everyone who uses MyDiiwaan; <strong>Part 2</strong> is the agreement between MyDiiwaan and each
        school about the school&apos;s records, which the school&apos;s admin accepts for the school. Our{" "}
        <Link href="/privacy">privacy policy</Link> explains what information is held and why.
      </p>

      <h2>Part 1 — Using MyDiiwaan</h2>
      <h3>Your account</h3>
      <ul>
        <li>Your school creates your account. Keep your password or PIN to yourself, and tell your school if you think someone else knows it.</li>
        <li>Use MyDiiwaan only for your school&apos;s education and administration, and only for what your role is for.</li>
        <li>
          Don&apos;t try to reach information that isn&apos;t yours to see, get round sign-in, PIN limits or other
          protections, interfere with the service, or use it to harass anyone or share anything unlawful.
        </li>
        <li>A school can switch an account off or delete it. We may suspend an account that breaks these terms or puts others at risk.</li>
      </ul>
      <h3>Children</h3>
      <p>
        Students use MyDiiwaan through their school, which is responsible for having their parents&apos; agreement.
        Students sign in with a PIN given by the school and see only their own work.
      </p>
      <h3>Religious content</h3>
      <p>
        MyDiiwaan shows the Qur&apos;an, recitations, the Qa&apos;idah and hadith to support teaching, not to replace a
        teacher. We take care over its accuracy; if you notice a mistake, please tell us at {email} and we will
        correct it.
      </p>
      <h3>The service</h3>
      <ul>
        <li>We work to keep MyDiiwaan available, secure and accurate, but it is provided as it is, and it may sometimes be unavailable or change.</li>
        <li>
          As far as the law allows, MyDiiwaan isn&apos;t liable for indirect losses, or for losses caused by information
          a school or user entered, or by misuse of an account. Nothing in these terms limits rights you have under
          the law that can&apos;t be limited.
        </li>
        <li>If these terms change, the new version will be posted here with a new date, and schools will be asked to accept changes to Part 2.</li>
      </ul>

      <h2>Part 2 — School Data Agreement</h2>
      <p>When a school&apos;s admin accepts these terms, the school and MyDiiwaan agree to the following.</p>
      <h3>Whose records they are</h3>
      <ul>
        <li>
          The records the school puts into MyDiiwaan — about its students, parents, staff, attendance, lessons, fees,
          salaries and expenses — belong to the school. The school decides what is recorded and who has an account.
        </li>
        <li>
          MyDiiwaan holds and processes those records only on the school&apos;s behalf, to provide the portal and the
          features the school uses, and for no other purpose. We don&apos;t sell them, use them for advertising, or
          share them except with the service providers named in the privacy policy, who process them only to run
          MyDiiwaan, or where the law requires.
        </li>
      </ul>
      <h3>The school&apos;s responsibilities</h3>
      <ul>
        <li>
          Having a lawful basis for the records it keeps, including <strong>parents&apos; agreement</strong> to their
          children&apos;s information being kept in MyDiiwaan (for example as part of enrolment), and telling families
          about the school&apos;s use of MyDiiwaan.
        </li>
        <li>Keeping its records accurate, giving accounts only to the right people, and switching off or removing accounts when people leave.</li>
        <li>Answering families&apos; requests to see, correct or delete their information, with our help where needed.</li>
      </ul>
      <h3>MyDiiwaan&apos;s responsibilities</h3>
      <ul>
        <li>Keeping the records secure: encrypted connections, each school&apos;s records separated from every other school&apos;s, and access limited by role.</li>
        <li>Limiting our own access to what is needed to support the school, keep the service working, or meet a legal requirement.</li>
        <li>
          <strong>Telling the school without undue delay</strong> if we learn of a breach affecting its records, with
          what we know and what we are doing about it, and helping the school with any notices it must give.
        </li>
        <li>Helping the school export its records, and deleting them when the school asks.</li>
      </ul>
      <h3>Keeping and deleting records</h3>
      <ul>
        <li>Records are kept while the school uses MyDiiwaan. The school can delete a student, and remove the records of students who have been inactive for over two years, from its Students page.</li>
        <li>When a school closes its account, its records and every account in it are deleted. Copies in encrypted backups are overwritten in the normal course of replacing those backups.</li>
      </ul>
      <h3>Fees</h3>
      <p>If the school has a paid plan, the price and payment terms are those agreed with the school separately.</p>
      <h3>Ending the agreement</h3>
      <p>
        The school can stop using MyDiiwaan at any time by closing its account. We may end the service for a school
        with reasonable notice, and will give the school the chance to export its records first.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: {email} · <Link href="/support">Help and support</Link>
      </p>
    </InfoPage>
  );
}

// The Arabic text follows the English one paragraph for paragraph; change
// both together.
function TermsArabic({ email }: { email: React.ReactNode }) {
  return (
    <>
      <p className="text-ink-muted">
        هذه ترجمة عربية للتيسير، وعند أي اختلاف بينها وبين النص الإنجليزي يُعتمد النص الإنجليزي.
      </p>
      <p>
        MyDiiwaan بوابة لمدارس القرآن والمدارس الإسلامية. وتتكون هذه الشروط من جزأين: <strong>الجزء الأول</strong>{" "}
        يسري على كل من يستخدم MyDiiwaan، و<strong>الجزء الثاني</strong> اتفاقية بين MyDiiwaan وكل مدرسة بشأن سجلاتها،
        يقبلها مدير المدرسة نيابةً عنها. وتوضّح <Link href="/privacy">سياسة الخصوصية</Link> المعلومات التي نحتفظ بها
        وسبب ذلك.
      </p>

      <h2>الجزء الأول — استخدام MyDiiwaan</h2>
      <h3>حسابك</h3>
      <ul>
        <li>مدرستك هي التي تنشئ حسابك. احتفظ بكلمة المرور أو الرقم السري لنفسك، وأخبر مدرستك إن ظننت أن غيرك يعرفه.</li>
        <li>استخدم MyDiiwaan لأغراض التعليم والإدارة في مدرستك فقط، وفي حدود دورك فيها.</li>
        <li>
          لا تحاول الوصول إلى معلومات ليس من حقك الاطلاع عليها، ولا التحايل على تسجيل الدخول أو حدود محاولات الرقم
          السري أو غيرها من وسائل الحماية، ولا تعطيل الخدمة، ولا استخدامها لإيذاء أحد أو نشر أي محتوى مخالف للقانون.
        </li>
        <li>للمدرسة أن توقف أي حساب أو تحذفه، ولنا أن نعلّق حسابًا يخالف هذه الشروط أو يعرّض الآخرين للخطر.</li>
      </ul>
      <h3>الأطفال</h3>
      <p>
        يستخدم الطلاب MyDiiwaan عن طريق مدرستهم، وهي المسؤولة عن الحصول على موافقة أولياء أمورهم. ويدخل الطلاب برقم
        سري تعطيهم إياه المدرسة، ولا يرون إلا أعمالهم.
      </p>
      <h3>المحتوى الديني</h3>
      <p>
        يعرض MyDiiwaan القرآن الكريم والتلاوات والقاعدة والأحاديث دعمًا للتعليم، لا بديلًا عن المعلم. ونحرص على
        دقته، فإن لاحظت خطأً فأخبرنا على {email} وسنصححه.
      </p>
      <h3>الخدمة</h3>
      <ul>
        <li>نعمل على أن يبقى MyDiiwaan متاحًا وآمنًا ودقيقًا، لكنه يُقدَّم على حاله، وقد يتوقف أحيانًا أو يتغير.</li>
        <li>
          في الحدود التي يسمح بها القانون، لا يتحمل MyDiiwaan مسؤولية الخسائر غير المباشرة، ولا الخسائر الناتجة عن
          معلومات أدخلتها مدرسة أو مستخدم، أو عن إساءة استخدام حساب. ولا يحدّ شيء في هذه الشروط من حقوقك القانونية التي
          لا يجوز تقييدها.
        </li>
        <li>إذا تغيرت هذه الشروط فستُنشر النسخة الجديدة هنا بتاريخ جديد، وسيُطلب من المدارس قبول ما يتغير في الجزء الثاني.</li>
      </ul>

      <h2>الجزء الثاني — اتفاقية بيانات المدرسة</h2>
      <p>حين يقبل مدير المدرسة هذه الشروط، تتفق المدرسة وMyDiiwaan على ما يلي.</p>
      <h3>ملكية السجلات</h3>
      <ul>
        <li>
          السجلات التي تُدخلها المدرسة في MyDiiwaan — عن طلابها وأولياء الأمور والموظفين والحضور والدروس والرسوم
          والرواتب والمصروفات — ملك للمدرسة، وهي التي تقرر ما يُسجَّل ومن يُمنح حسابًا.
        </li>
        <li>
          لا يحتفظ MyDiiwaan بهذه السجلات ولا يعالجها إلا نيابةً عن المدرسة، لتقديم البوابة والخصائص التي تستخدمها، ولا
          لغرض آخر. فلا نبيعها، ولا نستخدمها في الإعلانات، ولا نشاركها إلا مع مزوّدي الخدمة المذكورين في سياسة
          الخصوصية، الذين لا يعالجونها إلا لتشغيل MyDiiwaan، أو حيث يُلزمنا القانون.
        </li>
      </ul>
      <h3>مسؤوليات المدرسة</h3>
      <ul>
        <li>
          أن يكون لها مسوّغ مشروع للسجلات التي تحتفظ بها، ومن ذلك <strong>موافقة أولياء الأمور</strong> على حفظ معلومات
          أبنائهم في MyDiiwaan (مثلًا ضمن إجراءات التسجيل)، وأن تُعلم الأسر باستخدامها لـMyDiiwaan.
        </li>
        <li>أن تحافظ على دقة سجلاتها، وألا تمنح الحسابات إلا لأصحابها، وأن توقف الحسابات أو تحذفها عند مغادرة أصحابها.</li>
        <li>أن تستجيب لطلبات الأسر بالاطلاع على معلوماتهم أو تصحيحها أو حذفها، وسنساعدها في ذلك عند الحاجة.</li>
      </ul>
      <h3>مسؤوليات MyDiiwaan</h3>
      <ul>
        <li>حماية السجلات: اتصالات مشفّرة، وفصل سجلات كل مدرسة عن سجلات غيرها، وحصر الوصول بحسب الدور.</li>
        <li>ألا نطّلع بأنفسنا إلا على ما يلزم لدعم المدرسة أو إبقاء الخدمة تعمل أو الوفاء بمتطلب قانوني.</li>
        <li>
          <strong>إبلاغ المدرسة دون تأخير غير مبرر</strong> إذا علمنا بأي اختراق يمس سجلاتها، مع ما نعرفه وما نفعله حياله،
          ومساعدتها في أي إشعارات يلزمها تقديمها.
        </li>
        <li>مساعدة المدرسة على تصدير سجلاتها، وحذفها متى طلبت المدرسة ذلك.</li>
      </ul>
      <h3>حفظ السجلات وحذفها</h3>
      <ul>
        <li>تُحفظ السجلات ما دامت المدرسة تستخدم MyDiiwaan. ويمكن للمدرسة من صفحة الطلاب حذف أي طالب، وحذف سجلات الطلاب غير النشطين منذ أكثر من سنتين.</li>
        <li>عند إغلاق المدرسة حسابها تُحذف سجلاتها وجميع الحسابات التابعة لها. أما النسخ الموجودة في النسخ الاحتياطية المشفّرة فتُستبدل في المسار المعتاد لتجديد تلك النسخ.</li>
      </ul>
      <h3>الرسوم</h3>
      <p>إذا كانت المدرسة على خطة مدفوعة، فالسعر وشروط الدفع هي ما يُتفق عليه مع المدرسة بشكل منفصل.</p>
      <h3>إنهاء الاتفاقية</h3>
      <p>
        للمدرسة أن تتوقف عن استخدام MyDiiwaan في أي وقت بإغلاق حسابها. ولنا أن ننهي الخدمة لمدرسة ما بإشعار معقول،
        مع إتاحة الفرصة لها لتصدير سجلاتها أولًا.
      </p>

      <h2>التواصل</h2>
      <p>
        للأسئلة عن هذه الشروط: {email} · <Link href="/support">المساعدة والدعم</Link>
      </p>
    </>
  );
}
