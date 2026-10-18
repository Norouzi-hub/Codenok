/*
 * ارجاع به کارشناس دیگر، و حکمِ کارگزینیِ شخص.
 *
 *   ۱) پروندهٔ ارجاع‌شده به کارشناس دیگر دیگر کارِ ما نیست: نه در آمارِ
 *      گردش‌کار می‌آید، نه در «پرونده‌های ناقص»، نه در پیگیری‌های کارتابل.
 *   ۲) حکمی که به‌عنوان «مدرک شخص» بارگذاری شده، برای پرونده‌های آن شخص
 *      «حکم بارگذاری‌شده» است — در آمار، ریل و اقدامِ بعدی.
 *   ۳) بارگذاری حکمِ شخص، تاریخ حکم را در پرونده‌های در جریانِ او هم ثبت
 *      می‌کند؛ مختومه‌ها دست نمی‌خورند.
 *
 * همهٔ داده‌ها ساختگی‌اند.
 * اجرا:  node tools/test/referral.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/nokman/index.html');
const bootApp = require('./boot');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const page = await (await browser.newContext({ locale: 'fa-IR', viewport: { width: 1360, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  // ================================================ ارجاع به کارشناس دیگر
  console.log('— ارجاع به کارشناس دیگر —');
  const before = await page.evaluate(async () => {
    const J = window.J, WL = window.Worklist, M = window.Model;
    // پروندهٔ ناقص: از «حکم» گذشته (دعوت دارد) ولی تاریخ حکم ندارد
    const r = await M.create({
      caseNo: '1405881', status: 'مفتوح رسیدگی', firstName: 'سامان', lastName: 'نمونه',
      nationalId: '0098765431',
      intakeDate: J.addDays(J.today(), -20), deliveryDate: J.addDays(J.today(), -18),
      invitationLetterDate: J.addDays(J.today(), -10)
    });
    await window.Notes.add(M.get(r.id), 'پیگیری پاسخ واحد.', J.addDays(J.today(), -1));
    const cases = M.scoped();
    const pd = WL.pipelineDetail(cases);
    return {
      id: r.id,
      inc: WL.incomplete(cases).some(x => x.rec.id === r.id),
      intake: pd[0].passed, total: cases.length,
      follow: window.Notes.dueFollowUps(true).some(f => f.rec && f.rec.id === r.id)
    };
  });
  check('پیش از ارجاع: در ناقص‌ها و پیگیری‌ها هست', before.inc && before.follow);

  const after = await page.evaluate(async (id) => {
    const J = window.J, WL = window.Worklist, M = window.Model;
    const rec = M.get(id);
    await M.update(id, Object.assign({}, M.strip(rec), {
      transferDate: J.today(), transferTo: 'کارشناس دیگر'
    }));
    window.App.goWork();
    await new Promise(x => setTimeout(x, 600));
    const cases = M.scoped();
    const pd = WL.pipelineDetail(cases);
    const inAny = pd.some(s => s.recorded.concat(s.missing, s.here).some(r => r.id === id));
    const card = document.querySelector('.wl-card[data-sec="pipeline"]');
    if (card && card.classList.contains('is-collapsed')) card.querySelector('.wl-section-head h2').click();
    await new Promise(x => setTimeout(x, 300));
    const moved = document.querySelector('.wl-moved');
    return {
      inc: WL.incomplete(cases).some(x => x.rec.id === id),
      inAny, intake: pd[0].passed, rail: WL.pipeline(cases)[0].value,
      follow: window.Notes.dueFollowUps(true).some(f => f.rec && f.rec.id === id),
      moved: moved && moved.textContent,
      transferred: cases.filter(WL.isTransferred).length,
      action: WL.nextAction(M.get(id)).key
    };
  }, before.id);
  check('بعد از ارجاع: از «پرونده‌های ناقص» بیرون می‌رود', !after.inc);
  check('و از آمارِ گردش‌کار (هیچ مرحله‌ای او را نمی‌شمارد)', !after.inAny &&
    after.intake === before.intake - 1 && after.rail === after.intake,
    before.intake + ' → ' + after.intake);
  check('و پیگیری‌اش از کارتابل می‌رود', !after.follow);
  check('کارتِ گردش‌کار می‌گوید چند پرونده ارجاع‌شده و کنار رفته',
    !!after.moved && after.moved.indexOf(window_fa(after.transferred)) >= 0, after.moved);
  check('اقدامِ بعدی‌اش «ارجاع‌شده» است', after.action === 'transferred', after.action);

  // ================================================== حکمِ شخص
  console.log('\n— حکمِ کارگزینیِ شخص —');
  const dec = await page.evaluate(async () => {
    const J = window.J, WL = window.Worklist, M = window.Model, D = window.Docs;
    const base = { status: 'مفتوح رسیدگی', firstName: 'نیما', lastName: 'آزمونی',
      nationalId: '0011223344', intakeDate: J.addDays(J.today(), -9),
      deliveryDate: J.addDays(J.today(), -8) };
    const a = await M.create(Object.assign({ caseNo: '1405882' }, base));
    const b = await M.create(Object.assign({ caseNo: '1405883' }, base));
    const c = await M.create(Object.assign({ caseNo: '1405884' }, base, {
      status: 'مختومه', verdictDate: J.addDays(J.today(), -100) }));
    const x0 = { a: WL.nextAction(M.get(a.id)).key, has: WL.hasDecree(M.get(a.id)),
      rec: WL.pipelineDetail(M.scoped())[2].recorded.length };

    // مدرکِ شخص، همان‌طور که «مدارک شخص» ذخیره می‌کند (بی‌پوشهٔ واقعی)
    const doc = {
      id: 'tdoc' + Date.now(), chain: 'tch' + Date.now(), scope: 'person',
      personKey: 'n:0011223344', personName: 'نیما آزمونی', folderName: '_x', fileName: 'h.pdf',
      kind: 'حکم کارگزینی', docDate: J.addDays(J.today(), -3), version: 1, superseded: false,
      addedAt: new Date().toISOString(), title: '', letterNo: '', body: ''
    };
    await window.Store.put('docs', [doc]);
    await D.load();
    const ra = M.get(a.id);
    const x1 = {
      has: WL.hasDecree(ra), action: WL.nextAction(ra).key,
      date: WL.decreeDateOf(ra) === doc.docDate,
      audit: WL.audit(ra).find(s => s.key === 'decree'),
      rec: WL.pipelineDetail(M.scoped())[2].recorded.length
    };

    // بارگذاریِ تازه: تاریخِ حکم در پرونده‌های در جریانِ همان شخص ثبت می‌شود
    const filled = await D.applyToCase(ra, doc);
    return {
      x0, x1, filled: filled.map(f => f.key),
      a: M.get(a.id).decreeDate, b: M.get(b.id).decreeDate, c: M.get(c.id).decreeDate || '',
      want: doc.docDate
    };
  });
  check('بی‌حکم: پرونده سرِ «گرفتن حکم» است', dec.x0.a === 'decree' && !dec.x0.has);
  check('حکمِ «مدرک شخص»، برای پرونده‌اش حکم بارگذاری‌شده است', dec.x1.has && dec.x1.date &&
    dec.x1.action !== 'decree' && dec.x1.audit.recorded && !!dec.x1.audit.date, dec.x1.action);
  // سه پروندهٔ همین شخص (دو در جریان، یک مختومه) حالا حکم دارند
  check('و در آمارِ «حکم» برای همهٔ پرونده‌های او شمرده می‌شود', dec.x1.rec === dec.x0.rec + 3,
    dec.x0.rec + ' → ' + dec.x1.rec);
  check('بارگذاریِ حکمِ شخص، تاریخ حکم را در پرونده‌های در جریانِ او ثبت می‌کند',
    dec.a === dec.want && dec.b === dec.want && dec.filled.indexOf('decreeDate') >= 0);
  check('پروندهٔ مختومهٔ همان شخص دست نمی‌خورد', dec.c === '');

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

function window_fa(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
