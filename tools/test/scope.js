/*
 * تست دامنهٔ کار و فیلترِ «به‌جز».
 *
 * شکایت کاربر: «ارجاع به کارشناس دیگر، پروندهٔ من نیست ولی توی همهٔ
 * آمارها می‌آید» — و «می‌خوام یکسری آیتم نباشه، نه اینکه همه رو بزنم
 * غیر از اونی که نمی‌خوام».
 *
 * پس دو چیز سنجیده می‌شود: اینکه دامنه واقعاً در هر چهار صفحه اثر
 * بگذارد (نه فقط فهرست)، و اینکه هیچ‌وقت پنهان نماند — پنهان‌کاری در
 * آمار بدتر از آمار اشتباه است.
 *
 * اجرا:  node tools/test/scope.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
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
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);

  // چند پرونده را واقعاً ارجاع می‌دهیم تا چیزی برای کنار گذاشتن باشد
  const seeded = await page.evaluate(async () => {
    const M = window.Model, J = window.J;
    const ids = M.state.cases.slice(0, 4).map(c => c.id);
    await M.applyPatches(ids.map(id => ({
      id: id, patch: { transferDate: J.today(), transferTo: 'کارشناس دوم' }
    })), { kind: 'edit', note: 'ارجاع آزمایشی' });
    return { total: M.state.cases.length, transferred: ids.length };
  });

  console.log('\n— دامنه، در همهٔ شمارش‌ها —');

  const before = await page.evaluate(() => ({
    scoped: window.Model.scoped().length,
    report: window.Report.build(window.App.state.report).cases.length,
    worklist: window.Worklist.summary(window.Model.scoped()).total,
    on: window.Model.scopeIsOn()
  }));
  check('بدون دامنه، همه‌چیز شمرده می‌شود',
    before.scoped === seeded.total && !before.on,
    before.scoped + ' پرونده');

  const after = await page.evaluate(async () => {
    await window.Model.setScope({ hideTransferred: true });
    window.App.render();
    await new Promise(r => setTimeout(r, 300));
    return {
      scoped: window.Model.scoped().length,
      out: window.Model.outOfScopeCount(),
      report: window.Report.build(window.App.state.report).cases.length,
      query: window.Model.query({}).length,
      queryAll: window.Model.query({ all: true }).length,
      calendarHasTransferred: window.Calendar
        .collect('13000101', '15000101', ['action', 'due'])
        .some(i => {
          const rec = window.Model.get(i.caseId);
          return rec && rec.transferDate;
        })
    };
  });
  check('با روشن شدن دامنه، ارجاع‌شده‌ها از شمارش بیرون می‌روند',
    after.scoped === seeded.total - seeded.transferred &&
    after.out === seeded.transferred,
    after.scoped + ' مانده، ' + after.out + ' کنار');
  check('گزارش‌ها هم همان دامنه را می‌بینند', after.report === after.scoped,
    after.report + ' در گزارش');
  check('فهرست هم همان را می‌بیند', after.query === after.scoped);
  check('تقویم هم پرونده‌های بیرون دامنه را نمی‌آورد',
    after.calendarHasTransferred === false);
  check('ولی خروجی و پشتیبان همه‌چیز را می‌بینند (all)',
    after.queryAll === seeded.total, after.queryAll + ' پرونده');

  console.log('\n— دامنه هیچ‌وقت پنهان نمی‌ماند —');
  const visible = await page.evaluate(async () => {
    window.App.goWork();
    await new Promise(r => setTimeout(r, 400));
    const chip = document.querySelector('.scope-chip');
    const work = !!document.querySelector('.worklist .scope-banner');
    window.App.goList();
    await new Promise(r => setTimeout(r, 400));
    const list = !!document.querySelector('.list-main .scope-banner');
    window.App.goReport();
    await new Promise(r => setTimeout(r, 700));
    const rep = !!document.querySelector('.report-view .scope-banner');
    return {
      chipShown: chip && getComputedStyle(chip).display !== 'none',
      chipText: chip ? chip.textContent : '',
      work: work, list: list, report: rep
    };
  });
  check('چیپ نوار بالا می‌گوید دامنه‌ای فعال است',
    visible.chipShown && /ارجاع‌شده/.test(visible.chipText), visible.chipText);
  check('نوار توضیح در کارتابل، فهرست و گزارش‌ها دیده می‌شود',
    visible.work && visible.list && visible.report, JSON.stringify(visible));

  const cleared = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('.scope-banner button')]
      .find(b => b.textContent === 'نشان بده');
    btn.click();
    await new Promise(r => setTimeout(r, 500));
    return {
      on: window.Model.scopeIsOn(),
      scoped: window.Model.scoped().length,
      chipHidden: getComputedStyle(document.querySelector('.scope-chip')).display === 'none'
    };
  });
  check('«نشان بده» دامنه را برمی‌دارد و چیپ ناپدید می‌شود',
    !cleared.on && cleared.scoped === seeded.total && cleared.chipHidden,
    cleared.scoped + ' پرونده');

  const persists = await page.evaluate(async () => {
    await window.Model.setScope({ hideClosed: true });
    await window.Model.reload();
    return { on: window.Model.scopeIsOn(), sc: window.Model.scope() };
  });
  check('دامنه در تنظیمات می‌ماند، نه در همین صفحه',
    persists.on && persists.sc.hideClosed === true, JSON.stringify(persists.sc));
  await page.evaluate(() => window.Model.setScope({
    hideTransferred: false, hideClosed: false, expert: ''
  }));

  // ------------------------------------------------------ فیلتر «به‌جز»
  console.log('\n— فیلتر «به‌جز» —');
  await page.evaluate(async () => {
    window.App.state.filters = {};
    window.App.goList();
    await new Promise(r => setTimeout(r, 400));
  });

  const unit = await page.evaluate(() => {
    const vals = window.Model.distinct('orgUnit');
    const v = vals.map(x => ({
      v: x,
      n: window.Model.state.cases.filter(c => (c.orgUnit || '') === x).length
    })).sort((a, b) => b.n - a.n)[0];
    return v;
  });

  const inMode = await page.evaluate((v) => {
    window.App.state.filters = { orgUnit: [v] };
    window.App.refresh();
    return window.App.state.lastResult.length;
  }, unit.v);
  check('حالت «شامل» فقط همان را می‌آورد', inMode === unit.n,
    inMode + ' از ' + unit.n);

  const notMode = await page.evaluate(async (v) => {
    window.App.state.filters = {};
    window.App.refresh();
    await new Promise(r => setTimeout(r, 300));
    const g = [...document.querySelectorAll('.filter-group')]
      .find(d => /واحد سازمانی/.test(d.querySelector('summary').textContent));
    g.open = true;
    [...g.querySelectorAll('.filter-option')]
      .find(l => l.querySelector('.fo-label').textContent === v)
      .querySelector('input').click();
    await new Promise(r => setTimeout(r, 300));
    const g2 = [...document.querySelectorAll('.filter-group')]
      .find(d => /واحد سازمانی/.test(d.querySelector('summary').textContent));
    [...g2.querySelectorAll('.fm-btn')].find(b => b.textContent === 'به‌جز').click();
    await new Promise(r => setTimeout(r, 400));
    return {
      n: window.App.state.lastResult.length,
      filters: JSON.parse(JSON.stringify(window.App.state.filters)),
      chip: (document.querySelector('.fchip') || {}).textContent || '',
      neg: !!document.querySelector('.fchip.neg')
    };
  }, unit.v);
  check('«به‌جز» همه را می‌آورد جز همان',
    notMode.n === 31 - unit.n, notMode.n + ' = ۳۱ − ' + unit.n);
  check('و در فیلترها زیر کلید _not می‌نشیند، نه قاطیِ شامل',
    !notMode.filters.orgUnit && !!(notMode.filters._not || {}).orgUnit,
    JSON.stringify(notMode.filters));
  check('چیپِ فعال می‌گوید «به‌جز» و رنگش فرق دارد',
    /به‌جز/.test(notMode.chip) && notMode.neg, notMode.chip);

  const chipOff = await page.evaluate(async () => {
    document.querySelector('.fchip').click();
    await new Promise(r => setTimeout(r, 400));
    return {
      n: window.App.state.lastResult.length,
      filters: JSON.parse(JSON.stringify(window.App.state.filters)),
      chips: document.querySelectorAll('.fchip').length
    };
  });
  check('کلیک روی چیپ، همان صافی را برمی‌دارد',
    chipOff.n === 31 && !chipOff.chips && !chipOff.filters._not,
    chipOff.n + ' پرونده');

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
