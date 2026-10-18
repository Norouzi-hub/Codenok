/*
 * کارتابل: گردش‌کارِ کلیک‌خور، پرونده‌های ناقص، کارت‌ها و چیدمان.
 *
 *   ۱) هر مرحلهٔ ریل باز می‌شود: الان اینجا، ثبت‌شده، ناقص.
 *   ۲) «ناقص» یعنی از مرحله گذشته ولی تاریخش ثبت نشده؛ «تکمیل» پرونده را
 *      سرِ همان فیلد باز می‌کند.
 *   ۳) هر بخش یک کارت با پس‌زمینه است، جمع می‌شود، و ترتیبش با «چیدمان
 *      کارتابل» یا کشیدن عوض می‌شود و می‌ماند.
 *
 * اجرا:  node tools/test/dashboard.js
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
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fa-IR' })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  // یک پروندهٔ در جریان که از «حکم» گذشته ولی تاریخ حکم ندارد
  const id = await page.evaluate(async () => {
    const J = window.J;
    const r = await window.Model.create({
      caseNo: '1405990', status: 'مفتوح رسیدگی', firstName: 'آرمان', lastName: 'ساختگی',
      intakeDate: J.addDays(J.today(), -20), deliveryDate: J.addDays(J.today(), -18),
      invitationLetterDate: J.addDays(J.today(), -10)
    });
    window.App.goWork();
    await new Promise(x => setTimeout(x, 600));
    return r.id;
  });

  // ============================================== ممیزی، بی‌رابط
  console.log('— ممیزیِ گردش‌کار —');
  const au = await page.evaluate((id) => {
    const WL = window.Worklist, rec = window.Model.get(id);
    const a = WL.audit(rec);
    const by = k => a.find(x => x.key === k);
    const inc = WL.incomplete(window.Model.scoped()).find(x => x.rec.id === id);
    return { decree: by('decree'), invite: by('invite'), defect: by('defect'),
      inc: inc && inc.missing.map(m => m.key), fix: WL.fixField('decree') };
  }, id);
  check('مرحلهٔ گذشته و بی‌تاریخ «ناقص» است', au.decree.missing && !au.decree.recorded,
    JSON.stringify(au.decree));
  check('مرحلهٔ ثبت‌شده «ثبت‌شده» است', au.invite.recorded && !au.invite.missing);
  check('مرحلهٔ اختیاری ناقص شمرده نمی‌شود', !au.defect.missing);
  check('در فهرست پرونده‌های ناقص، با کمبودش', au.inc && au.inc.join() === 'decree', String(au.inc));

  // ===================================================== ریل و پنل
  console.log('\n— ریلِ کلیک‌خور —');
  const panel = await page.evaluate(async () => {
    const hits = [...document.querySelectorAll('.wl-pipe-card .rail-hit')];
    const decree = hits.find(h => /حکم/.test(h.querySelector('.rail-name').textContent));
    const badge = (decree.querySelector('.rail-miss') || {}).textContent;
    decree.click();
    await new Promise(r => setTimeout(r, 400));
    const p = document.querySelector('.wl-st-panel');
    return { badge, title: p && p.querySelector('h3').textContent,
      tabs: p ? [...p.querySelectorAll('.wl-st-tab')].map(t => t.textContent) : [],
      on: p && (p.querySelector('.wl-st-tab.on') || {}).textContent,
      rows: p ? p.querySelectorAll('.wl-st-row.is-missing').length : 0,
      has: p && /1405990/.test(p.textContent) };
  });
  check('روی گره، شمارِ ناقص‌ها', !!panel.badge, panel.badge);
  check('کلیک، پنلِ مرحله را با سه فهرست باز می‌کند', /حکم/.test(panel.title || '') && panel.tabs.length === 3,
    panel.tabs.join(' | '));
  check('پیش‌فرض، فهرستِ ناقص‌ها — و پروندهٔ ما در آن', /ناقص/.test(panel.on || '') && panel.rows > 0 && panel.has);

  const fix = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.wl-st-row.is-missing')].find(r => /1405990/.test(r.textContent));
    row.querySelector('.wl-fix').click();
    await new Promise(r => setTimeout(r, 1100));
    const f = document.querySelector('[data-field="decreeDate"]');
    return { view: window.App.state.view, caseNo: (window.Model.get(window.App.state.caseId) || {}).caseNo,
      field: !!f, flash: f && (f.classList.contains('field-flash') || document.activeElement && f.contains(document.activeElement)) };
  });
  check('«تکمیل» پرونده را سرِ همان فیلد باز می‌کند', fix.view === 'case' && fix.caseNo === '1405990' && fix.field && fix.flash,
    JSON.stringify(fix));

  const after = await page.evaluate(async (id) => {
    const M = window.Model, J = window.J;
    await M.update(id, Object.assign({}, M.strip(M.get(id)), { decreeDate: J.addDays(J.today(), -15) }));
    window.App.goWork();
    await new Promise(r => setTimeout(r, 500));
    return !window.Worklist.incomplete(M.scoped()).some(x => x.rec.id === id);
  }, id);
  check('بعد از تکمیل، از فهرستِ ناقص‌ها بیرون می‌رود', after);

  const incBar = await page.evaluate(async () => {
    const bar = document.querySelector('.wl-inc-bar');
    if (!bar) return null;
    bar.click();
    await new Promise(r => setTimeout(r, 400));
    const p = document.querySelector('.wl-st-panel');
    return { title: p.querySelector('h3').textContent, chips: p.querySelectorAll('.wl-miss').length,
      tabs: [...p.querySelectorAll('.wl-st-tab')].map(t => t.textContent) };
  });
  check('نوارِ «پرونده‌های ناقص» همه را با کمبودهایشان نشان می‌دهد',
    incBar && /ناقص/.test(incBar.title) && incBar.chips > 0 && incBar.tabs.length === 2,
    incBar && incBar.tabs.join(' | '));

  // ============================================== کارت‌ها و چیدمان
  console.log('\n— کارت‌ها و چیدمان —');
  const cards = await page.evaluate(() => {
    const list = [...document.querySelectorAll('.worklist > .wl-card')];
    return {
      n: list.length,
      keys: list.map(c => c.dataset.sec),
      bg: list.every(c => { const b = getComputedStyle(c).backgroundColor; return b && b !== 'rgba(0, 0, 0, 0)'; }),
      grips: list.every(c => c.querySelector('.wl-grip') && c.querySelector('.wl-fold'))
    };
  });
  check('هر بخش یک کارت با پس‌زمینه، دستگیره و دکمهٔ جمع کردن', cards.n >= 3 && cards.bg && cards.grips,
    cards.keys.join('،'));

  const lay = await page.evaluate(async () => {
    const W = window.UIWorklist;
    // ۱) کشیدن: «منتظر اقدام ما» به بالای «گردش‌کار»
    await W.moveSection(window.App, 'ours', 'pipeline', true);
    await new Promise(r => setTimeout(r, 300));
    const k1 = [...document.querySelectorAll('.worklist > .wl-card')].map(c => c.dataset.sec);
    // ۲) جمع کردن
    document.querySelector('.wl-card[data-sec="pipeline"] .wl-fold').click();
    await new Promise(r => setTimeout(r, 300));
    const folded = document.querySelector('.wl-card[data-sec="pipeline"]').classList.contains('is-collapsed');
    const railHidden = getComputedStyle(document.querySelector('.wl-card[data-sec="pipeline"] .rail')).display === 'none';
    // ۳) پنجرهٔ چیدمان: پنهان کردنِ «منتظر دیگران» و بالا بردنِ «گردش‌کار»
    W.layoutDialog(window.App);
    await new Promise(r => setTimeout(r, 200));
    const items = () => [...document.querySelectorAll('.wl-lay-list .cols-item')];
    const theirs = items().find(li => /منتظر دیگران/.test(li.textContent));
    theirs.querySelector('input[type=checkbox]').click();
    const pipe = items().find(li => /گردش‌کار/.test(li.textContent));
    pipe.querySelector('.cols-mv').click();      // ↑
    [...document.querySelectorAll('.wl-lay-modal .modal-foot .btn')].pop().click();
    await new Promise(r => setTimeout(r, 400));
    const L = window.UIWorklist.layout();
    return {
      k1, folded, railHidden, order: L.order, hidden: L.hidden,
      shown: [...document.querySelectorAll('.worklist > .wl-card')].map(c => c.dataset.sec),
      note: (document.querySelector('.wl-hidden-note') || {}).textContent || '',
      saved: (window.Model.state.settings.worklistLayout || {}).order
    };
  });
  const ip = lay.k1.indexOf('ours'), pp = lay.k1.indexOf('pipeline');
  check('کشیدنِ کارت، ترتیب را عوض می‌کند', ip >= 0 && pp >= 0 && ip === pp - 1, lay.k1.join('،'));
  check('جمع کردن، فقط سرِ کارت را نگه می‌دارد', lay.folded && lay.railHidden);
  check('«چیدمان کارتابل»: پنهان کردن و جابه‌جایی', lay.hidden.theirs && lay.shown.indexOf('theirs') < 0 &&
    lay.order.indexOf('pipeline') < lay.order.indexOf('ours'), lay.order.join('،'));
  check('بخشِ پنهان گفته می‌شود، با راهِ برگشت', /پنهان/.test(lay.note) && /منتظر دیگران/.test(lay.note));
  check('چیدمان در تنظیماتِ دیتابیس ذخیره است', Array.isArray(lay.saved) && lay.saved.length === 8);

  const reset = await page.evaluate(async () => {
    window.UIWorklist.layoutDialog(window.App);
    await new Promise(r => setTimeout(r, 200));
    [...document.querySelectorAll('.wl-lay-modal .modal-foot .btn')][0].click();
    await new Promise(r => setTimeout(r, 400));
    const L = window.UIWorklist.layout();
    return { order: L.order.join(), def: window.UIWorklist.SECTIONS.map(s => s.key).join(),
      hidden: Object.keys(L.hidden).length, folded: Object.keys(L.collapsed).length };
  });
  check('«بازگشت به پیش‌فرض»', reset.order === reset.def && !reset.hidden && !reset.folded);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
