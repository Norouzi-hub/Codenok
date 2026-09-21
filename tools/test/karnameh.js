/*
 * تست کارنامه و «بارگذاری، خودش یک کار است».
 *
 * این دو با هم یک چیزند: برنامه تا امروز خوب می‌گفت «چه مانده» و بد
 * می‌گفت «چه کردم» — و کاربر برنامه را برای همین ساخته بود، چون آخر
 * هفته باید به مدیرش گزارش بدهد.
 *
 * اجرا:  node tools/test/karnameh.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const bootApp = require('./boot');
const MOCK_FS = require('./mockfs');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krn-'));
  const files = [];
  for (let i = 1; i <= 10; i++) {
    const f = path.join(dir, 'ray-' + i + '.pdf');
    fs.writeFileSync(f, 'x' + i);
    files.push(f);
  }

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
  await page.evaluate(MOCK_FS);
  await page.evaluate(() => window.Docs.linkFolder());

  // ------------------------------------------- بازه‌های هفته و ماه
  console.log('\n— بازه‌ها —');
  const ranges = await page.evaluate(() => {
    const K = window.Karnameh, J = window.J;
    const w1 = K.range('week');
    const p = J.unpack(w1.from);
    return {
      weekStartsSaturday: J.weekday(p.jy, p.jm, p.jd),
      weekFrom: w1.from, weekTo: w1.to,
      lastWeekLen: (J.diffDays(K.range('lastWeek').to, K.range('lastWeek').from) || 0) + 1,
      monthFrom: K.range('month').from,
      lastMonth: K.range('lastMonth')
    };
  });
  check('هفته از شنبه شروع می‌شود',
    ranges.weekStartsSaturday === 'شنبه', ranges.weekStartsSaturday);
  check('هفتهٔ گذشته دقیقاً هفت روز است', ranges.lastWeekLen === 7);
  check('ماه از روز یکم شروع می‌شود',
    /01$/.test(ranges.monthFrom), ranges.monthFrom);
  check('ماه گذشته، ماهِ کامل قبلی است',
    /01$/.test(ranges.lastMonth.from) &&
    ranges.lastMonth.to > ranges.lastMonth.from &&
    ranges.lastMonth.to < ranges.monthFrom,
    ranges.lastMonth.from + ' تا ' + ranges.lastMonth.to);

  // ------------------------------------- بارگذاری، خودش یک کار است
  console.log('\n— بارگذاری دسته‌ای، به‌عنوان کارِ انجام‌شده —');
  await page.evaluate(() => window.App.goArchive());
  await page.waitForSelector('.arc-view');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      [...document.querySelectorAll('.arc-plate button')]
        .find(b => /بارگذاری دسته‌ای/.test(b.textContent)).click();
    })
  ]);
  await chooser.setFiles(files);
  await page.waitForSelector('.doc-add-modal');
  await page.waitForTimeout(400);

  const hasCheckbox = await page.evaluate(() =>
    !!document.querySelector('.batch-astask input[type="checkbox"]:checked'));
  check('گزینهٔ «ثبت به‌عنوان کار» هست و پیش‌فرض روشن است', hasCheckbox);

  const made = await page.evaluate(async () => {
    const m = document.querySelector('.doc-add-modal');
    const head = m.querySelector('.batch-head');
    const k = head.querySelector('select.input.small');
    k.value = 'رأی کمیته';
    k.dispatchEvent(new Event('change', { bubbles: true }));
    const bn = [...head.querySelectorAll('input.input')]
      .find(i => /اسکن آرای/.test(i.placeholder || ''));
    bn.value = 'اسکن آرا';
    bn.dispatchEvent(new Event('input', { bubbles: true }));
    head.querySelector('.batch-apply').click();
    await new Promise(r => setTimeout(r, 250));
    const rows = [...m.querySelectorAll('.doc-add-row')];
    [0, 1].forEach((idx, i) => {
      const rec = window.Model.state.cases[i];
      const ci = rows[idx].querySelector('.dcase-field input');
      ci.value = rec.caseNo;
      ci.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 250));
    [...m.querySelectorAll('.btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 3500));
    const b = window.Docs.batches()[0];
    const tasks = window.Notes.tasksOfBatch(b.id);
    return {
      batchId: b.id, docs: b.docs.length, cases: b.caseCount, general: b.general,
      tasks: tasks.map(t => ({
        title: t.title, status: t.status, onCase: !!t.caseId,
        docCount: t.docCount, cat: t.category
      }))
    };
  });
  check('یک کارِ کلی برای دسته ساخته شد، از پیش انجام‌شده',
    made.tasks.some(t => /^اسکن آرا — /.test(t.title) && t.status === 'done' &&
      !t.onCase && t.docCount === 10),
    made.tasks.map(t => t.title).join(' | '));
  /* «یه نسخه ازش به همون پرونده» — هر پرونده‌ای که دسته لمسش کرده،
     کارِ خودش را می‌گیرد. */
  check('هر پروندهٔ لمس‌شده هم یک کارِ انجام‌شده گرفت',
    made.tasks.filter(t => t.onCase).length === made.cases && made.cases === 2,
    made.cases + ' پرونده');
  check('دستهٔ کارها «بایگانی و اسکن» است',
    made.tasks.every(t => t.cat === 'بایگانی و اسکن'));

  const link = await page.evaluate(async () => {
    window.App.state.taskFilter = 'all';
    window.App.goTasks();
    await new Promise(r => setTimeout(r, 500));
    const box = document.querySelector('.task-done-box');
    if (box) box.open = true;
    await new Promise(r => setTimeout(r, 200));
    const btn = document.querySelector('.task-batch');
    if (!btn) return 'دکمهٔ بایگانی روی کار نبود';
    btn.click();
    await new Promise(r => setTimeout(r, 500));
    return {
      hash: location.hash,
      batchId: window.App.state.archive.batchId,
      docs: document.querySelectorAll('.arc-doc').length
    };
  });
  check('کار در فهرست کارها دیده می‌شود و به بایگانی لینک دارد',
    link.hash === '#/archive' && link.batchId === made.batchId && link.docs === 10,
    JSON.stringify(link));

  // ------------------------------------------------------- کارنامه
  console.log('\n— کارنامه —');
  const k = await page.evaluate(() => {
    const J = window.J;
    const data = window.Karnameh.build(J.today(), J.today(), {});
    return {
      docs: data.totals.docs, batches: data.totals.batches,
      tasksDone: data.totals.tasksDone,
      headline: window.Karnameh.headline(data),
      batchNames: data.docs.batches.map(b => b.name),
      taskTitles: data.tasks.done.map(t => t.title)
    };
  });
  check('کارنامهٔ امروز، سندها و نوبت بارگذاری را می‌شمرد',
    k.docs === 10 && k.batches === 1, k.docs + ' سند در ' + k.batches + ' نوبت');
  check('و هر سه کارِ ساخته‌شده را',
    k.tasksDone === 3 && k.taskTitles.some(t => /اسکن آرا/.test(t)),
    k.taskTitles.join(' | '));
  check('جملهٔ سرِ گزارش، فارسی و کامل است',
    /سند بایگانی شد/.test(k.headline) && /\.$/.test(k.headline), k.headline);

  const empty = await page.evaluate(() => {
    const J = window.J;
    const far = J.addDays(J.today(), 400);
    const d = window.Karnameh.build(far, far, {});
    return { total: d.totals.docs + d.totals.tasksDone + d.totals.events,
      headline: window.Karnameh.headline(d), rest: d.rest.open };
  });
  check('بازهٔ خالی، خالی گزارش می‌شود — ولی «چه ماند» همیشه هست',
    empty.total === 0 && /ثبت نشده/.test(empty.headline) && empty.rest > 0,
    empty.headline);

  const view = await page.evaluate(async () => {
    window.App.state.reportTab = 'karnameh';
    window.App.goReport();
    await new Promise(r => setTimeout(r, 900));
    return {
      tabs: [...document.querySelectorAll('.rep-tab')].map(t => t.textContent),
      active: (document.querySelector('.rep-tab.on') || {}).textContent,
      plate: !!document.querySelector('.krn-plate'),
      tally: [...document.querySelectorAll('.krn-plate .tally-label')].map(x => x.textContent),
      bars: document.querySelectorAll('.krn-bar').length,
      rest: !!document.querySelector('.krn-rest')
    };
  });
  check('گزارش‌ها دو تب دارد و کارنامه جای خودش را دارد',
    view.tabs.length === 2 && view.active === 'کارنامهٔ من' && view.plate,
    view.tabs.join(' | '));
  check('خط شمارش کارنامه، واحدهای کارِ دبیرخانه را می‌شمرد',
    view.tally.indexOf('نامهٔ صادره') >= 0 &&
    view.tally.indexOf('سند بایگانی‌شده') >= 0 &&
    view.tally.indexOf('کار انجام‌شده') >= 0, view.tally.join(' | '));
  check('نوارهای سهم و بند «چه ماند» هستند', view.bars > 0 && view.rest);

  const switched = await page.evaluate(async () => {
    [...document.querySelectorAll('.krn-range .chip-btn')]
      .find(b => b.textContent === 'این ماه').click();
    await new Promise(r => setTimeout(r, 600));
    return {
      range: window.App.state.karnameh.range,
      label: document.querySelector('.wl-eyebrow-date').textContent
    };
  });
  check('عوض کردن بازه، گزارش را همان‌جا بازمی‌سازد',
    switched.range === 'month' && switched.label.length > 5, switched.label);

  // -------------------------------------------------- خروجی‌ها
  console.log('\n— خروجی ورد —');
  const docx = await page.evaluate(async () => {
    const data = window.UIKarnameh.current(window.App);
    const saved = [];
    const real = window.U.download;
    window.U.download = function (name, blob) { saved.push({ name: name, size: blob.size }); };
    try { window.UIKarnameh.wordOut(data); } finally { window.U.download = real; }
    return saved[0] || null;
  });
  check('کارنامه خروجی ورد می‌دهد',
    docx && /^karnameh-\d{8}-\d{8}\.docx$/.test(docx.name) && docx.size > 2000,
    docx ? docx.name + ' — ' + docx.size + ' بایت' : 'چیزی ذخیره نشد');

  // -------------------------------------------------------- کارتابل
  console.log('\n— «امروز چه شد» در کارتابل —');
  const wl = await page.evaluate(async () => {
    window.App.goWork();
    await new Promise(r => setTimeout(r, 700));
    const box = document.querySelector('.wl-today-log');
    return {
      has: !!box,
      text: box ? box.querySelector('summary').textContent : '',
      tally: [...document.querySelectorAll('.tally-label')].map(x => x.textContent)
    };
  });
  check('کارتابل می‌گوید امروز چه شد', wl.has && /سند/.test(wl.text), wl.text);
  check('و شمارندهٔ «انجام‌شدهٔ امروز» را دارد',
    wl.tally.indexOf('انجام‌شدهٔ امروز') >= 0, wl.tally.join(' | '));

  const jump = await page.evaluate(async () => {
    document.querySelector('.wl-today-log .wl-log-more').click();
    await new Promise(r => setTimeout(r, 700));
    return { hash: location.hash, tab: window.App.state.reportTab };
  });
  check('و از همان‌جا به کارنامه می‌رود',
    jump.hash === '#/report' && jump.tab === 'karnameh', JSON.stringify(jump));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
