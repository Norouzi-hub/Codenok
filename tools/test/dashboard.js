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
  check('نوارِ «پرونده‌های ناقص» در جریان‌ها را با کمبودهایشان نشان می‌دهد (مختومه‌ها نه)',
    incBar && /ناقص/.test(incBar.title) && incBar.chips > 0 && incBar.tabs.length === 0,
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

  // ================================================== آکاردئون
  console.log('\n— آکاردئون —');
  const openKeys = () => page.evaluate(() => [...document.querySelectorAll('.worklist > .wl-card')]
    .filter(c => !c.classList.contains('is-collapsed')).map(c => c.dataset.sec));
  const acc0 = await page.evaluate(() => {
    const list = [...document.querySelectorAll('.worklist > .wl-card')];
    const closed = list.filter(c => c.classList.contains('is-collapsed'));
    return {
      n: list.length, open: list.length - closed.length, first: !list[0].classList.contains('is-collapsed'),
      heads: closed.every(c => getComputedStyle(c.querySelector('.wl-section-head')).display !== 'none'),
      bodies: closed.every(c => [...c.children].filter(x => !x.classList.contains('wl-section-head'))
        .every(x => getComputedStyle(x).display === 'none')),
      badges: closed.filter(c => c.dataset.badge).map(c => [c.dataset.sec,
        (c.querySelector('.wl-acc-n') || {}).textContent, getComputedStyle(c.querySelector('.wl-acc-n')).display]),
      bar: !!document.querySelector('.wl-acc-bar .wl-acc-opt.on'),
      aria: list.map(c => c.querySelector('.wl-section-head').getAttribute('aria-expanded')).join()
    };
  });
  check('پیش‌فرض آکاردئونی: فقط بخشِ اول باز است، بقیه فقط سرتیتر', acc0.open === 1 && acc0.first &&
    acc0.heads && acc0.bodies, JSON.stringify({ n: acc0.n, open: acc0.open, aria: acc0.aria }));
  check('سرتیترِ بخشِ جمع، شمارِ خلاصه دارد', acc0.badges.length > 0 &&
    acc0.badges.every(b => b[1] && b[2] !== 'none'), JSON.stringify(acc0.badges));

  // کلیکِ واقعی روی سرتیتر — بی‌رندرِ دوباره
  await page.evaluate(() => { document.querySelector('.worklist').__mark = 1; });
  await page.click('.wl-card[data-sec="pipeline"] .wl-section-head h2');
  await page.waitForTimeout(450);
  const acc1 = await page.evaluate(() => ({
    mark: document.querySelector('.worklist').__mark === 1,
    saved: window.UIWorklist.layout().open,
    rail: getComputedStyle(document.querySelector('.wl-card[data-sec="pipeline"] .rail')).display
  }));
  const o1 = await openKeys();
  check('کلیک روی سرتیتر، همان بخش را باز و بقیه را جمع می‌کند', o1.length === 1 && o1[0] === 'pipeline' &&
    acc1.rail !== 'none', o1.join('،'));
  check('در همان صفحه، بی‌رندر؛ و بخشِ باز ذخیره می‌شود', acc1.mark && acc1.saved === 'pipeline');

  await page.evaluate(async () => { window.App.render(); await new Promise(r => setTimeout(r, 300)); });
  const o2 = await openKeys();
  check('بعد از رندرِ دوباره هم همان بخش باز است', o2.length === 1 && o2[0] === 'pipeline', o2.join('،'));

  await page.focus('.wl-card[data-sec="pipeline"] .wl-section-head');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const o3 = await openKeys();
  check('Enter روی سرتیتر، جمعش می‌کند (همه بسته)', o3.length === 0, o3.join('،'));

  // دکمه‌های داخلِ سرتیتر بخش را باز و بسته نمی‌کنند
  const inner = await page.evaluate(async () => {
    const c = document.querySelector('.wl-card[data-sec="week"]');
    const grip = c.querySelector('.wl-grip');
    grip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    return c.classList.contains('is-collapsed');
  });
  check('کلیک روی دستگیره، بخش را باز نمی‌کند', inner);

  // حالت «آزاد»: چند بخش با هم، و باز/بستنِ همه
  await page.click('.wl-acc-opt:not(.on)');
  await page.waitForTimeout(400);
  await page.click('.wl-card[data-sec="week"] .wl-section-head h2');
  await page.click('.wl-card[data-sec="pipeline"] .wl-section-head h2');
  await page.waitForTimeout(300);
  const free = await openKeys();
  const free2 = await page.evaluate(() => window.UIWorklist.layout());
  check('حالت «آزاد»: چند بخش با هم باز می‌مانند', !free2.accordion && free.indexOf('week') >= 0 &&
    free.indexOf('pipeline') >= 0, free.join('،'));
  await page.click('.wl-acc-none');
  await page.waitForTimeout(300);
  const none = await openKeys();
  await page.click('.wl-acc-all');
  await page.waitForTimeout(300);
  const allOpen = await openKeys();
  const nCards = await page.evaluate(() => document.querySelectorAll('.worklist > .wl-card').length);
  check('«بستن همه» و «باز کردن همه»', none.length === 0 && allOpen.length === nCards,
    none.length + ' / ' + allOpen.length + ' از ' + nCards);

  // «باز کردن همه» در حالت یکی‌یکی، به حالت آزاد می‌رود
  await page.click('.wl-acc-opt:not(.on)');
  await page.waitForTimeout(400);
  const back = await openKeys();
  await page.click('.wl-acc-all');
  await page.waitForTimeout(400);
  const all2 = await openKeys();
  const L2 = await page.evaluate(() => window.UIWorklist.layout());
  check('برگشت به «یکی‌یکی» فقط یکی را باز نگه می‌دارد؛ «باز کردن همه» آزادش می‌کند',
    back.length === 1 && all2.length === nCards && !L2.accordion, back.join('،'));

  const lay = await page.evaluate(async () => {
    const W = window.UIWorklist;
    // ۱) کشیدن: «منتظر اقدام ما» به بالای «گردش‌کار»
    await W.moveSection(window.App, 'ours', 'pipeline', true);
    await new Promise(r => setTimeout(r, 300));
    const k1 = [...document.querySelectorAll('.worklist > .wl-card')].map(c => c.dataset.sec);
    // ۲) جمع کردن
    // (حالت آزاد است — از آزمونِ بالا) کلیک روی سرتیتر جمعش می‌کند
    document.querySelector('.wl-card[data-sec="pipeline"] .wl-section-head h2').click();
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
      hidden: Object.keys(L.hidden).length, folded: Object.keys(L.collapsed).length, acc: L.accordion };
  });
  check('«بازگشت به پیش‌فرض» (و دوباره آکاردئونی)', reset.order === reset.def && !reset.hidden &&
    !reset.folded && reset.acc === true);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
