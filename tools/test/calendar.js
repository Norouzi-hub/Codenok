/*
 * تست تقویم.
 *
 * دو چیز اینجا مهم است و بقیه فرع: اینکه شبکهٔ ماه واقعاً تقویم فارسی
 * باشد (شنبه ستون اول، طول ماه و سال کبیسه درست، ماه قبل/بعد سرریز
 * نکند)، و اینکه هر مورد روی تقویم جایی برود — تقویمی که فقط نگاه
 * کردنی باشد، دفعهٔ دوم باز نمی‌شود.
 *
 * اجرا:  node tools/test/calendar.js
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
    viewport: { width: 1500, height: 1000 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);

  // ------------------------------------------------------- تقویم فارسی
  console.log('\n— تقویم فارسی —');

  const cal = await page.evaluate(() => {
    const J = window.J;
    // ۱ فروردین ۱۴۰۴ = ۲۱ مارس ۲۰۲۵ = جمعه؛ اسفند ۱۴۰۳ کبیسه (۳۰ روز)
    return {
      firstDay: J.weekday(1404, 1, 1),
      idx: J.weekdayIndex(1404, 1, 1),
      esfand1403: J.monthLength(1403, 12),
      esfand1404: J.monthLength(1404, 12),
      mehr: J.monthLength(1404, 7)
    };
  });
  check('نام و شمارهٔ روز هفته با هم می‌خوانند (شنبه = ۰)',
    cal.idx === 6 && cal.firstDay === 'جمعه',
    '۱ فروردین ۱۴۰۴ = ' + cal.firstDay + '، ستون ' + cal.idx);
  check('طول ماه‌ها و کبیسه درست است',
    cal.esfand1403 === 30 && cal.esfand1404 === 29 && cal.mehr === 30,
    'اسفند ۱۴۰۳=' + cal.esfand1403 + '، اسفند ۱۴۰۴=' + cal.esfand1404);

  const grid = await page.evaluate(() => {
    const m = window.Calendar.month(1404, 1, []);
    const first = m.weeks[0];
    const all = [].concat.apply([], m.weeks);
    const inMonth = all.filter(c => c.inMonth);
    return {
      cells: all.length,
      inMonth: inMonth.length,
      firstInMonthCol: first.findIndex(c => c.inMonth),
      lastDate: inMonth[inMonth.length - 1].date,
      leadFromPrev: first.filter(c => !c.inMonth).map(c => c.jd),
      multipleOf7: all.length % 7 === 0
    };
  });
  check('ماه با ستون درستِ هفته شروع می‌شود',
    grid.firstInMonthCol === 6, 'ستون ' + grid.firstInMonthCol);
  check('همهٔ روزهای ماه در شبکه‌اند و شبکه کامل است',
    grid.inMonth === 31 && grid.multipleOf7 && grid.lastDate === '14040131',
    grid.inMonth + ' روز در ' + grid.cells + ' خانه');
  check('خانه‌های خالیِ اول، روزهای ماه قبل‌اند نه جای خالی',
    grid.leadFromPrev.length === 6 &&
    grid.leadFromPrev[grid.leadFromPrev.length - 1] === 30 &&
    grid.leadFromPrev[0] === 25,
    grid.leadFromPrev.join('،'));

  const rollover = await page.evaluate(() => {
    const C = window.Calendar;
    return {
      next: C.shift(1404, 12, 1),
      prev: C.shift(1404, 1, -1),
      jump: C.shift(1404, 6, 8)
    };
  });
  check('رفتن به ماه بعد/قبل، سال را درست سرریز می‌کند',
    rollover.next.jy === 1405 && rollover.next.jm === 1 &&
    rollover.prev.jy === 1403 && rollover.prev.jm === 12 &&
    rollover.jump.jy === 1405 && rollover.jump.jm === 2,
    JSON.stringify(rollover));

  // ------------------------------------------------------------ لایه‌ها
  console.log('\n— لایه‌ها —');

  const seeded = await page.evaluate(async () => {
    const J = window.J, N = window.Notes, M = window.Model;
    const rec = M.state.cases[0];
    await N.create({ kind: 'task', title: 'اسکن مدارک', caseId: rec.id,
      followUp: J.today() });
    await N.create({ kind: 'task', title: 'کار بی‌پرونده', followUp: J.today() });
    await N.add(M.state.cases[1], 'تماس گرفته شد.', J.today());
    const today = J.today();
    const byLayer = {};
    window.Calendar.collect(today, today,
      ['task', 'follow', 'action', 'due', 'event']).forEach(i => {
        byLayer[i.layer] = (byLayer[i.layer] || 0) + 1;
      });
    return byLayer;
  });
  check('کار و پیگیری روی روزِ سررسیدشان می‌نشینند',
    seeded.task === 2 && seeded.follow === 1, JSON.stringify(seeded));

  const layerOff = await page.evaluate(() => {
    const today = window.J.today();
    return {
      only: window.Calendar.collect(today, today, ['follow'])
        .every(i => i.layer === 'follow'),
      none: window.Calendar.collect(today, today, []).length
    };
  });
  check('خاموش کردن یک لایه واقعاً حذفش می‌کند',
    layerOff.only && layerOff.none === 0, layerOff.none + ' مورد با لایهٔ خالی');

  const rangeOnly = await page.evaluate(() => {
    const J = window.J;
    const far = J.addDays(J.today(), 400);
    return window.Calendar.collect(far, far, window.Calendar.DEFAULT_ON).length;
  });
  check('بازه رعایت می‌شود؛ روزِ خالی خالی می‌ماند', rangeOnly === 0);

  const eventLayer = await page.evaluate(() => {
    const today = window.J.today();
    const ev = window.Calendar.collect(today, today, ['event']);
    return { n: ev.length, allHaveCase: ev.every(e => !!e.caseId) };
  });
  check('رویدادهای تاریخچه هم روی تقویم می‌آیند و پرونده‌دارند',
    eventLayer.n > 0 && eventLayer.allHaveCase, eventLayer.n + ' رویداد');

  // -------------------------------------------------------------- نما
  console.log('\n— نما —');
  await page.evaluate(() => window.App.goCalendar());
  await page.waitForSelector('.cal-view');
  await page.waitForTimeout(400);

  const view = await page.evaluate(() => ({
    hash: location.hash,
    days: document.querySelectorAll('.cal-day').length,
    weekdayFirst: document.querySelector('.cal-wd .cal-wd-long').textContent,
    today: document.querySelectorAll('.cal-day.today').length,
    navActive: (document.querySelector('.nav-btn.active') || {}).textContent,
    chips: document.querySelectorAll('.cal-chip').length,
    eventChipOff: !document.querySelector('.cal-chip.t-event').classList.contains('on')
  }));
  check('نما نشانی خودش را دارد و در نوار بالا فعال است',
    view.hash === '#/calendar' && view.navActive === 'تقویم', view.hash);
  check('شبکه از شنبه شروع می‌شود و امروز یکی است و نشان‌دار',
    view.weekdayFirst === 'شنبه' && view.today === 1 && view.days % 7 === 0,
    view.days + ' خانه');
  check('لایهٔ «رویدادها» پیش‌فرض خاموش است تا تقویم شلوغ نشود',
    view.chips === 5 && view.eventChipOff);

  const scroll = await page.evaluate(() => {
    const v = document.querySelector('.cal-view');
    return { can: v.scrollHeight >= v.clientHeight, overflow: getComputedStyle(v).overflowY };
  });
  check('نما خودش اسکرول دارد (مثل بقیهٔ نماها)', scroll.overflow === 'auto');

  /* خانهٔ روز حداکثر سه سطر نشان می‌دهد، پس شمردن سطرهای شبکه چیزی را
     نمی‌سنجد؛ شمارندهٔ خودِ ماه سنجهٔ درست است. */
  const toggled = await page.evaluate(async () => {
    const count = () => {
      const t = [...document.querySelectorAll('.cal-nav .wl-count')][0].textContent;
      return +window.U.toLatinDigits(t).replace(/\D+/g, '');
    };
    const before = count();
    document.querySelector('.cal-chip.t-event').click();
    await new Promise(r => setTimeout(r, 300));
    const after = count();
    const on = document.querySelector('.cal-chip.t-event').classList.contains('on');
    document.querySelector('.cal-chip.t-event').click();
    await new Promise(r => setTimeout(r, 300));
    return { before: before, after: after, on: on, back: count() };
  });
  check('چیپ لایه، تقویم را همان‌جا عوض می‌کند و برمی‌گردد',
    toggled.after > toggled.before && toggled.on && toggled.back === toggled.before,
    toggled.before + ' → ' + toggled.after + ' → ' + toggled.back);

  const monthNav = await page.evaluate(async () => {
    const title = () => document.querySelector('.cal-title').textContent;
    const start = title();
    document.querySelectorAll('.cal-arrow')[1].click();
    await new Promise(r => setTimeout(r, 250));
    const next = title();
    document.querySelectorAll('.cal-arrow')[0].click();
    await new Promise(r => setTimeout(r, 250));
    return { start: start, next: next, back: title() };
  });
  check('دکمه‌های ماه جلو و عقب می‌برند و برمی‌گردند',
    monthNav.next !== monthNav.start && monthNav.back === monthNav.start,
    monthNav.start + ' → ' + monthNav.next);

  // ------------------------------------------------- کلیک روی هر مورد
  console.log('\n— هر مورد جایی می‌رود —');

  const dayPanel = await page.evaluate(async () => {
    const t = document.querySelector('.cal-day.today');
    t.click();
    await new Promise(r => setTimeout(r, 300));
    return {
      groups: [...document.querySelectorAll('.cal-group-head')].map(h => h.textContent),
      items: document.querySelectorAll('.cal-panel .cal-item').length,
      picked: document.querySelectorAll('.cal-day.picked').length
    };
  });
  check('کلیک روی یک روز، همه‌چیزِ آن روز را گروه‌بندی‌شده نشان می‌دهد',
    dayPanel.items >= 3 && dayPanel.groups.length >= 2 && dayPanel.picked === 1,
    dayPanel.groups.join(' | '));

  const toCase = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.cal-panel .cal-item')]
      .find(b => b.classList.contains('l-follow'));
    if (!row) return 'سطر پیگیری پیدا نشد';
    row.click();
    await new Promise(r => setTimeout(r, 500));
    return location.hash;
  });
  check('کلیک روی یک پیگیری، همان پرونده را باز می‌کند',
    /^#\/case\//.test(toCase), toCase);

  const toTask = await page.evaluate(async () => {
    window.App.goCalendar();
    await new Promise(r => setTimeout(r, 350));
    document.querySelector('.cal-day.today').click();
    await new Promise(r => setTimeout(r, 300));
    const rows = [...document.querySelectorAll('.cal-panel .cal-item.l-task')];
    const standalone = rows.find(b => /بی‌پرونده/.test(b.textContent));
    if (!standalone) return 'کار بی‌پرونده در پانل نبود';
    standalone.click();
    await new Promise(r => setTimeout(r, 400));
    const m = document.querySelector('.task-modal');
    const title = m ? m.querySelector('.task-title-input').value : '';
    if (m) document.querySelector('.overlay').remove();
    return title;
  });
  check('کلیک روی کارِ بی‌پرونده، پنجرهٔ خودِ آن کار را باز می‌کند',
    toTask === 'کار بی‌پرونده', toTask);

  const addHere = await page.evaluate(async () => {
    window.App.goCalendar();
    await new Promise(r => setTimeout(r, 350));
    const cells = [...document.querySelectorAll('.cal-day:not(.out)')];
    const target = cells[cells.length - 1];
    target.click();
    await new Promise(r => setTimeout(r, 300));
    const want = window.App.state.calDay;
    document.querySelector('.cal-add').click();
    await new Promise(r => setTimeout(r, 350));
    const m = document.querySelector('.task-modal');
    const shown = window.U.toLatinDigits(m.querySelector('.date-field input').value);
    document.querySelector('.overlay').remove();
    return { want: window.J.format(want, { latin: true }), shown: shown };
  });
  check('«کار تازه برای این روز» سررسید همان روز را از پیش می‌گذارد',
    addHere.shown === addHere.want, addHere.shown + ' (انتظار ' + addHere.want + ')');

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
