# لوحة التربية الإسلامية — الصف الخامس

لوحة صفّية تفاعلية (مجموعات + ألعاب + لوحة نقاط) لستة دروس من التربية الإسلامية للصف الخامس (الفصل الأول):

**الوحدة الثانية**

- **غزوة بدر** (ص72–79) — اختبار سريع، ترتيب الأحداث، ذاكرة «بُطولات خالدة»
- **الأخوّة الإسلامية** (ص80–88) — المس المنطقة (حقوق الأخوة من الصور)، ترتيب حديث «خُمُس»، أخوة النسب/الدين، اختبار، قصة قرارات «يوسف الزميل الجديد»

**الوحدة الرابعة** (طبعة الكتاب ٢٠٢٦/٢٠٢٧)

- **أحكام الحج** (ص150–159) — اختبار، ترتيب أركان الحج، شرط أم ركن، المس الصورة
- **الإحرام** (ص160–167) — اختبار، سنّة أم محظور، المس الصورة (محظورات الإحرام)، ذاكرة المفاهيم
- **غزوة أحد** (ص168–175) — اختبار، ترتيب الأحداث، أبطال الغزوة، مقارنة بدر وأحد، المس خريطة المعركة، قصة قرارات «قرارات يوم أحد»
- **الصداقة** (ص176–183) — اختبار، حامل المسك أم نافخ الكير، الصفة وأثرها، قصة قرارات «اختر صديقك»

**الاستخدام في الصف:** تُعرض على شاشة اللمس (Edge/Chrome) ويتقدم الطلبة لللمس — الدور turns بديل بين المجموعات،
ولكل إجابة صحيحة نقطة واحدة للمجموعة صاحبة الدور. تُحفظ النقاط في المتصفح نفسه (ولسحبها لجهاز آخر أو نسخة احتياطية: ⚙️ ← تصدير).

**الواجهة:** وضعان يبدّلهما زر 🌙/☀️ في الشريط العلوي (يُحفظ الاختيار مع النسخة الاحتياطية): **نهاري «رمل وأقواس»** (الافتراضي) و**ليلي «زمرّد ومصحف»**، بأزرار كبيرة للمس وخطّي El Messiri (العناوين) وBaloo Bhaijaan 2 (مضمّنين داخل الملف، يعمل دون إنترنت). لوحة النقاط في صفحة واحدة: الصفوف على الجانب ومجموعات الصف المختار بجانبها.
**الإعدادات** (⚙️): إضافة صفوف وحذفها وإعادة تسميتها، وتعديل مجموعات كل صف (٢–٦: الاسم، الشعار، اللون)، ونسخة احتياطية، وتصفير النقاط.

**الفتح:** https://connector6375.github.io/islamic-dashboard/ — أو تنزيل `index.html` وفتحه بنقرة مزدوجة (يعمل دون إنترنت بالكامل).

**قابلية الوصول والتثبيت:** اللوحة تعمل بلوحة المفاتيح وقارئات الشاشة (نوافذ حقيقية، وEsc يغلق النوافذ، وإعلان النقاط صوتيًا)، وعند فتحها من رابط https (مثل GitHub Pages) يمكن تثبيتها كتطبيق وتعمل دون إنترنت بعد الزيارة الأولى. فتحها من الملف مباشرة يعمل كما كان.

**نسخة على جهازك تتحدّث تلقائيًا من GitHub:** شغّل مرة واحدة (ويندوز، PowerShell):
`powershell -ExecutionPolicy Bypass -File tools\sync-from-github.ps1 -Target "<المجلد>" -Install`
فيُنزَّل آخر ما على الفرع إلى المجلد ويتجدّد كل ١٥ دقيقة. على ماك/لينكس: `sh tools/sync-from-github.sh "<المجلد>"` مع cron. لا يلزم Git ولا حساب (المستودع عام)، ولا يحذف شيئًا من المجلد.

---

# Islamic-education classroom dashboard — grade 5

A single-file, offline-first gamified classroom dashboard (groups, turn-based touch games, +1/−1 scoreboard)
for six grade-5 lessons (semester 1: unit 2 — Badr, Islamic brotherhood; unit 4 — rulings of Hajj, Ihram,
the Battle of Uhud, friendship). Built from the textbook pages (2026/27 edition) and the teacher's prep plans; one self-contained
`index.html` with no CDNs or external images; the one web font (Baloo Bhaijaan 2, SIL OFL) is embedded.

Two themes, switched with the moon/sun button in the top bar and saved in `state.settings.theme`: light "Sand & arches"
(default) and dark "Emerald & Mushaf" (design handoff on branch `theme-sand-emerald`), on top of the "Classroom Dashboard" layout
(large touch targets). The stylesheets are exported in `src/styles/`.
The scoreboard is one split page (classes beside the selected class's groups), and classes and their groups
(2–6 each: name, logo, colour) are edited on the ⚙️ settings page. Saves from before the redesign are upgraded
automatically (points kept, group colours mapped to the new palette).

## Updating the lessons
The dashboard's source project (curriculum data, game engines, build tool, textbook crops) lives on the
teacher's machine; this repository contains the built output. Rebuild → replace `index.html` → push.

## Mirroring to your computer
`tools/sync-from-github.ps1` (Windows) and `tools/sync-from-github.sh` (Mac/Linux) copy the latest commit of a
public branch into a local folder: no Git or login needed, nothing in the folder is deleted. With `-Install`
the PowerShell script also schedules itself (default every 15 minutes). Point `-Target` at a folder that Google
Drive for desktop syncs and the files reach Drive too, without Drive's 10 MB upload limit.

## Modern-web notes
- **Accessibility:** WCAG 2.2 AA checked with axe-core on every screen and state (0 violations); overlays are real dialogs
  (`role="dialog"`, page behind is `inert`, focus moves in and returns, Esc closes modals), route changes update the title and
  move focus to the heading, scores are announced through a live region, skip link, phone-width tabs keep their names.
- **Performance:** figures are WebP (−32 %) in a JSON block placed *after* the app, so the page is drawn and usable before they
  arrive; figures are `loading="lazy"`.
- **Platform:** CSP (`default-src 'none'`, same-origin network only), `color-scheme`/`theme-color` (follow the theme, applied before first paint), safe-area insets, `dvh`,
  `text-wrap`, forced-colors support, inline favicon.
- **Installable + offline** when served over https (GitHub Pages): `manifest.webmanifest`, `sw.js` (stale-while-revalidate),
  `icons/`. The service worker is registered only over http(s); opening `index.html` from disk is unchanged.
- Known limits: the CSP keeps `'unsafe-inline'` because the app is one file of inline code; the sort game's falling cards are
  time-based; the file is ~2.1 MB (mostly figures), so Lighthouse's throttled-phone performance score stays modest.
