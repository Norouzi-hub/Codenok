/*
 * کیفیتِ پرونده — نقصِ مختومه‌ها سابقه است، نه کار.
 *
 *   ۱) پروندهٔ مختومه از «پرونده‌های ناقص» و شمارِ ناقصِ مرحله‌ها بیرون است.
 *   ۲) لحظهٔ مختومه شدن، نقص‌ها ثبت می‌شوند و بعداً عوض نمی‌شوند؛ تکمیلِ
 *      بعدی با «تکمیل پس از ختم» و تاریخش کنارشان می‌آید.
 *   ۳) مختومه‌های پیش از این نسخه «پیش از سنجش کیفیت»اند و در آمار نیستند.
 *   ۴) کادرِ «کیفیت پرونده» در خودِ پرونده، و تبِ «کیفیت پرونده‌ها» در گزارش‌ها.
 *   ۵) زمان‌سنج: بی‌کاری تا ده دقیقه هنوز کار است.
 *
 * همهٔ داده‌ها ساختگی‌اند.
 * اجرا:  node tools/test/quality.js
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

  // ======================================================= ختم و عکس
  console.log('— ختمِ پرونده و ثبتِ نقص‌ها —');
  const a = await page.evaluate(async () => {
    const J = window.J, WL = window.Worklist, M = window.Model, Q = window.Quality;
    const r = await M.create({
      caseNo: '1405771', status: 'مفتوح رسیدگی', firstName: 'پویا', lastName: 'نمونه‌ای',
      nationalId: '0055667788',
      intakeDate: J.addDays(J.today(), -40), deliveryDate: J.addDays(J.today(), -38),
      invitationLetterDate: J.addDays(J.today(), -30), committeeDate: J.addDays(J.today(), -20),
      verdictDate: J.addDays(J.today(), -18)
    });
    const openInc = WL.incomplete(M.scoped()).some(x => x.rec.id === r.id);
    const openQ = Q.of(M.get(r.id));
    await M.update(r.id, Object.assign({}, M.strip(M.get(r.id)), { status: 'مختومه' }));
    const rec = M.get(r.id);
    const q = Q.of(rec);
    const pd = WL.pipelineDetail(M.scoped());
    return {
      id: r.id, openInc, openQ,
      closedInc: WL.incomplete(M.scoped()).some(x => x.rec.id === r.id),
      inMissing: pd.some(s => s.missing.some(x => x.id === r.id)),
      passedDecree: pd.find(s => s.key === 'decree').recorded.concat(pd.find(s => s.key === 'decree').missing).length,
      q, since: Q.data().since
    };
  });
  check('پیش از ختم: در «پرونده‌های ناقص» هست، و کیفیت ندارد', a.openInc && a.openQ === null);
  check('بعد از ختم: از «پرونده‌های ناقص» و شمارِ ناقصِ مرحله‌ها بیرون می‌رود',
    !a.closedInc && !a.inMissing);
  check('لحظهٔ ختم سنجیده شد: «حکم» بی‌تاریخ ثبت است', a.q && a.q.measured && !a.q.complete &&
    a.q.missing.some(m => m.key === 'decree' && m.state === 'open'),
    a.q && a.q.missing.map(m => m.key).join('،'));
  check('شروعِ سنجش ثبت شده', /^\d{8}$/.test(a.since || ''), a.since);

  // تکمیل پس از ختم
  const fixed = await page.evaluate(async (id) => {
    const J = window.J, M = window.Model, Q = window.Quality;
    const n0 = Q.of(M.get(id)).missing.length;
    await M.update(id, Object.assign({}, M.strip(M.get(id)), { decreeDate: J.addDays(J.today(), -35) }));
    const q = Q.of(M.get(id));
    const d = q.missing.find(m => m.key === 'decree');
    return { n0, n1: q.missing.length, state: d && d.state, at: d && d.fixedAt, today: J.today(),
      fixed: q.fixed, open: q.open };
  }, a.id);
  check('تکمیلِ بعد از ختم سابقه را پاک نمی‌کند: «تکمیل پس از ختم» با تاریخ',
    fixed.n1 === fixed.n0 && fixed.state === 'fixed' && fixed.at === fixed.today && fixed.fixed === 1,
    JSON.stringify(fixed));

  // پروندهٔ کامل
  const full = await page.evaluate(async () => {
    const J = window.J, WL = window.Worklist, M = window.Model, Q = window.Quality;
    const d = n => J.addDays(J.today(), -n);
    const r = await M.create({
      caseNo: '1405772', status: 'مفتوح رسیدگی', firstName: 'کیان', lastName: 'کامل',
      nationalId: '0055667799',
      intakeDate: d(60), deliveryDate: d(59), decreeDate: d(58), invitationLetterDate: d(50),
      committeeDate: d(40), verdictDate: d(39), verdictSignDate: d(38), noticeDate: d(37),
      noticeResultDate: d(30), archiveDate: d(1)
    });
    // هرچه هنوز در ممیزیِ یک نسخهٔ مختومه کم است، پر می‌شود
    const probe = WL.audit(Object.assign({}, M.get(r.id), { status: 'مختومه' }))
      .filter(x => x.missing).map(x => x.key);
    const patch = {};
    probe.forEach(k => { const f = WL.fixField(k); if (f) patch[f] = d(20); });
    await M.update(r.id, Object.assign({}, M.strip(M.get(r.id)), patch, { status: 'مختومه' }));
    return { id: r.id, probe, q: Q.of(M.get(r.id)) };
  });
  check('پرونده‌ای که همه‌چیزش ثبت است «کامل بسته شد»', full.q && full.q.measured && full.q.complete,
    'پر شد: ' + full.probe.join('،'));

  // پیش از سنجش
  const before = await page.evaluate(() => {
    const WL = window.Worklist, M = window.Model, Q = window.Quality;
    const old = M.scoped().filter(c => WL.isClosed(c) && !Q.data().cases[c.id]);
    const s = Q.stats(M.scoped());
    return { old: old.length, q: old[0] && Q.of(old[0]), un: s.unmeasured.length, T: s.totals,
      pending: s.pending.map(x => x.rec.caseNo) };
  });
  check('مختومه‌های قدیمی «پیش از سنجش»اند و در آمار نیستند', before.old > 0 && before.q &&
    before.q.measured === false && before.un === before.old && before.T.measured === 2,
    JSON.stringify(before.T));
  check('آمار: نیمی کامل، نقص‌ها و تکمیل‌ها شمرده شده', before.T.complete === 1 && before.T.pct === 50 &&
    before.T.fixed === 1 && before.T.missing >= 1);
  check('مختومهٔ «هنوز ناقص» در فهرستِ تکمیل', before.pending.indexOf('1405771') >= 0 ||
    (before.T.open === 0 && before.pending.length === 0), before.pending.join('،'));

  // ============================================== بازگشایی و ختمِ دوباره
  const re = await page.evaluate(async (id) => {
    const M = window.Model, Q = window.Quality;
    const at0 = Q.data().cases[id].iso;
    await M.update(id, Object.assign({}, M.strip(M.get(id)), { status: 'مفتوح رسیدگی' }));
    const open = Q.of(M.get(id));
    await new Promise(r => setTimeout(r, 20));
    await M.update(id, Object.assign({}, M.strip(M.get(id)), { status: 'مختومه' }));
    const snap = Q.data().cases[id];
    return { open, again: snap.iso !== at0, decree: snap.missing.some(m => m.key === 'decree') };
  }, a.id);
  check('بازگشایی: کیفیتی نشان داده نمی‌شود؛ ختمِ دوباره از نو سنجیده می‌شود',
    re.open === null && re.again && !re.decree);

  // ============================================== کادرِ خودِ پرونده
  console.log('\n— کادرِ «کیفیت پرونده» —');
  const box = await page.evaluate(async () => {
    const M = window.Model, J = window.J;
    // یک پروندهٔ مختومهٔ ناقص با یک نقصِ تکمیل‌شده
    const r = await M.create({
      caseNo: '1405773', status: 'مفتوح رسیدگی', firstName: 'رها', lastName: 'آزمایشی',
      nationalId: '0055667711', intakeDate: J.addDays(J.today(), -30),
      deliveryDate: J.addDays(J.today(), -29), verdictDate: J.addDays(J.today(), -5)
    });
    await M.update(r.id, Object.assign({}, M.strip(M.get(r.id)), { status: 'مختومه' }));
    await M.update(r.id, Object.assign({}, M.strip(M.get(r.id)), { decreeDate: J.addDays(J.today(), -28) }));
    window.App.openCase(r.id);
    await new Promise(x => setTimeout(x, 600));
    const b = document.querySelector('.q-box');
    const res = b && {
      cls: b.className, title: b.querySelector('.q-title').textContent,
      fixed: b.querySelectorAll('.q-item.is-fixed').length,
      open: b.querySelectorAll('.q-item.is-open').length
    };
    const fix = b && b.querySelector('.q-fix');
    if (fix) fix.click();
    await new Promise(x => setTimeout(x, 600));
    res.focused = document.activeElement && document.activeElement.closest('[data-field]')
      ? document.activeElement.closest('[data-field]').dataset.field : '';
    // پروندهٔ قدیمی
    const old = M.scoped().find(c => /مختومه/.test(c.status) && !window.Quality.data().cases[c.id]);
    window.App.openCase(old.id);
    await new Promise(x => setTimeout(x, 500));
    res.old = (document.querySelector('.q-box') || {}).className || '';
    return res;
  });
  check('بالای پروندهٔ مختومه: «موقع ختم … مرحلهٔ بی‌تاریخ»', box && /is-open/.test(box.cls) &&
    /موقع ختم/.test(box.title), box && box.title);
  check('نقصِ تکمیل‌شده خط‌خورده با «تکمیل پس از ختم»، بقیه با دکمهٔ «تکمیل»',
    box && box.fixed === 1 && box.open > 0, box && (box.fixed + ' / ' + box.open));
  check('«تکمیل» پرونده را سرِ همان فیلد می‌برد', box && !!box.focused, box && box.focused);
  check('پروندهٔ قدیمی: «پیش از سنجش کیفیت»', /is-before/.test(box.old));

  // ============================================== گزارش
  console.log('\n— گزارش‌ها ← کیفیت پرونده‌ها —');
  const rep = await page.evaluate(async () => {
    window.App.state.reportTab = 'quality';
    window.App.goReport();
    await new Promise(x => setTimeout(x, 700));
    const tab = [...document.querySelectorAll('.rep-tab')].find(t => /کیفیت/.test(t.textContent));
    return {
      on: tab && tab.classList.contains('on'),
      tiles: [...document.querySelectorAll('.q-tile b')].map(b => b.textContent),
      cards: [...document.querySelectorAll('.q-card h3')].map(h => h.textContent),
      before: (document.querySelector('.q-before') || {}).textContent || '',
      pending: document.querySelectorAll('.q-pending .wl-st-row').length,
      chips: document.querySelectorAll('.q-pending .wl-miss').length
    };
  });
  check('تبِ «کیفیت پرونده‌ها» با کاشی‌ها', rep.on && rep.tiles.length === 4, rep.tiles.join(' | '));
  check('روند ماه‌به‌ماه، مرحله‌های جاافتاده، و فهرستِ تکمیل', rep.cards.some(c => /ماه/.test(c)) &&
    rep.cards.some(c => /مرحله/.test(c)) && rep.pending > 0 && rep.chips > 0, rep.cards.join(' | '));
  check('شمارِ مختومه‌های «پیش از سنجش» گفته می‌شود', /پیش از سنجش/.test(rep.before));

  // ماندگاری
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const kept = await page.evaluate((id) => {
    const q = window.Quality.of(window.Model.get(id));
    return q && q.measured;
  }, full.id);
  check('بعد از رفرش، سابقهٔ کیفیت سرِ جایش است', kept === true);

  // ============================================== زمان‌سنج
  console.log('\n— زمان‌سنج —');
  const tl = await page.evaluate(() => {
    const T = window.Timelog;
    T._idle(300);
    const a5 = (function () { const before = JSON.stringify(T.all()); T.tick(); return JSON.stringify(T.all()) !== before; })();
    T._idle(T.IDLE + 30);
    const a11 = (function () { const before = JSON.stringify(T.all()); T.tick(); return JSON.stringify(T.all()) !== before; })();
    return { idle: T.IDLE, a5, a11 };
  });
  check('بی‌کاری تا ده دقیقه هنوز کار است؛ بیشتر از آن نه', tl.idle === 600 && tl.a5 && !tl.a11,
    JSON.stringify(tl));

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
