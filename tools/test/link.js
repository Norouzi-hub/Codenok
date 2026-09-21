/*
 * تست یکپارچگی — «همه‌چیز به هم ربط داشته باشد».
 *
 * این مجموعه، هیچ قابلیت تازه‌ای را نمی‌سنجد. یک چیز را می‌سنجد و آن
 * هم چیزی است که در برنامه‌ای با هفت نما راحت می‌شکند: **یک رویداد،
 * هر جا باید دیده شود دیده می‌شود، و از هر جا می‌شود به مبدأش برگشت.**
 *
 * سناریو یکی است و همهٔ نماها را با همان می‌سنجیم: یک نوبت اسکن با ده
 * سند که دو پرونده را می‌گیرد و هشت سندِ بی‌پرونده دارد. این یک رویداد
 * باید در بایگانی، کارها، تقویم، کارتابل، کارنامه و خودِ پرونده دیده
 * شود — با لینک برگشت.
 *
 * و دامنهٔ کار باید در همهٔ شمارش‌ها یکسان اثر کند؛ صفحه‌ای که چیزی را
 * بشمرد که صفحهٔ دیگر نمی‌شمرد، به کاربر دروغ می‌گوید.
 *
 * اجرا:  node tools/test/link.js
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-'));
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

  // ---------------------------------------------- سناریو: یک نوبت اسکن
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
    const ids = [];
    [0, 1].forEach((idx, i) => {
      const rec = window.Model.state.cases[i];
      ids.push(rec.id);
      const ci = rows[idx].querySelector('.dcase-field input');
      ci.value = rec.caseNo;
      ci.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 250));
    [...m.querySelectorAll('.btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 3500));
    return { batchId: window.Docs.batches()[0].id, caseIds: ids };
  });

  // ------------------------------------ یک رویداد، شش جا دیده می‌شود
  console.log('\n— یک نوبت اسکن، هر جا باید دیده شود —');

  const inArchive = await page.evaluate(() => ({
    batches: window.Docs.batches().length,
    docs: window.Docs.visibleDocs().length
  }));
  check('۱) بایگانی: دسته و سندهایش',
    inArchive.batches === 1 && inArchive.docs === 10,
    inArchive.docs + ' سند در ' + inArchive.batches + ' دسته');

  const inTasks = await page.evaluate((b) => {
    const t = window.Notes.tasksOfBatch(b);
    return { n: t.length, allDone: t.every(x => x.status === 'done'),
      linked: t.every(x => x.batchId === b) };
  }, made.batchId);
  check('۲) کارها: کارِ انجام‌شده، با پیوند به همان دسته',
    inTasks.n === 3 && inTasks.allDone && inTasks.linked, inTasks.n + ' کار');

  const inCalendar = await page.evaluate(async () => {
    const J = window.J, today = J.today();
    // یک کارِ انجام‌شدهٔ معمولی، بی‌ربط به بارگذاری
    await window.Notes.create({ kind: 'task', done: true, title: 'پرینت دستور کار' });
    const all = window.Calendar.collect(today, today,
      ['due', 'task', 'follow', 'doc', 'action', 'event']);
    const noDoc = window.Calendar.collect(today, today, ['task']);
    return {
      docLayer: all.filter(i => i.layer === 'doc'),
      doneTasks: all.filter(i => i.layer === 'task' && i.done).length,
      batchTasksWithDoc: all.filter(i => i.layer === 'task' &&
        /اسکن آرا/.test(i.label)).length,
      batchTasksWithoutDoc: noDoc.filter(i => /اسکن آرا/.test(i.label)).length,
      defaultOn: window.Calendar.DEFAULT_ON.indexOf('doc') >= 0
    };
  });
  check('۳) تقویم: نوبت بارگذاری یک سطر دارد، نه ده سطر',
    inCalendar.docLayer.length === 1 &&
    /اسکن آرا — ۱۰ سند/.test(inCalendar.docLayer[0].label),
    inCalendar.docLayer.map(i => i.label).join(' | '));
  check('و لایهٔ اسناد پیش‌فرض روشن است', inCalendar.defaultOn);
  /* کارِ بی‌سررسیدی که همان روز انجام شده، قبلاً اصلاً روی تقویم نمی‌آمد */
  /* کارِ بی‌سررسیدی که همان روز انجام شده، قبلاً اصلاً روی تقویم نمی‌آمد */
  check('۴) تقویم: کارِ انجام‌شده روی روزِ انجامش می‌نشیند',
    inCalendar.doneTasks === 1 &&
    inCalendar.docLayer.length === 1, inCalendar.doneTasks + ' کار');
  /* یک رویداد، یک سطر: کارِ ساخته‌شده از دسته با خودِ دسته دوتایی نشود */
  check('و کارِ ساخته‌شده از دسته، سطر دوم نمی‌سازد',
    inCalendar.batchTasksWithDoc === 0 && inCalendar.batchTasksWithoutDoc === 3,
    'با لایهٔ سند ' + inCalendar.batchTasksWithDoc +
    ' / بدونش ' + inCalendar.batchTasksWithoutDoc);

  const calGo = await page.evaluate(async (b) => {
    window.App.goCalendar();
    await new Promise(r => setTimeout(r, 600));
    document.querySelector('.cal-day.today').click();
    await new Promise(r => setTimeout(r, 400));
    const row = [...document.querySelectorAll('.cal-panel .cal-item.l-doc')][0];
    if (!row) return 'سطر سند در پانل نبود';
    row.click();
    await new Promise(r => setTimeout(r, 600));
    return { hash: location.hash, batchId: window.App.state.archive.batchId,
      match: window.App.state.archive.batchId === b };
  }, made.batchId);
  check('۵) و کلیک رویش، همان دسته را در بایگانی باز می‌کند',
    calGo.hash === '#/archive' && calGo.match, JSON.stringify(calGo));

  const inWork = await page.evaluate(async () => {
    window.App.goWork();
    await new Promise(r => setTimeout(r, 700));
    const box = document.querySelector('.wl-today-log');
    return { has: !!box, text: box ? box.querySelector('summary').textContent : '' };
  });
  check('۶) کارتابل: «امروز چه شد» همین را می‌گوید',
    inWork.has && /سند/.test(inWork.text) && /کار/.test(inWork.text), inWork.text);

  const inKarnameh = await page.evaluate(() => {
    const J = window.J;
    const d = window.Karnameh.build(J.today(), J.today(), {});
    return { docs: d.totals.docs, batches: d.totals.batches,
      tasks: d.totals.tasksDone, names: d.docs.batches.map(b => b.name) };
  });
  check('۷) کارنامه: همان اعداد، از همان منبع',
    inKarnameh.docs === 10 && inKarnameh.batches === 1 &&
    inKarnameh.tasks === 4 && inKarnameh.names[0] === 'اسکن آرا',
    JSON.stringify(inKarnameh));

  const inCase = await page.evaluate(async (ids) => {
    window.App.state.formTab = '__notes';
    window.App.openCase(ids[0]);
    await new Promise(r => setTimeout(r, 600));
    const box = document.querySelector('.task-case-panel .task-done-box');
    if (box) box.open = true;
    await new Promise(r => setTimeout(r, 200));
    const titles = [...document.querySelectorAll('.task-case-panel .task-title')]
      .map(t => t.textContent);
    window.App.state.formTab = '__docs';
    window.App.render();
    await new Promise(r => setTimeout(r, 500));
    return {
      titles: titles,
      batchLink: !!document.querySelector('.doc-batch button')
    };
  }, made.caseIds);
  check('۸) خودِ پرونده: کارِ همان پرونده در تبش دیده می‌شود',
    inCase.titles.some(t => /از دستهٔ «اسکن آرا»/.test(t)),
    inCase.titles.join(' | '));
  check('و سند داخل پرونده، راه برگشت به دسته دارد', inCase.batchLink);

  const caseToArchive = await page.evaluate(async (b) => {
    document.querySelector('.doc-batch button').click();
    await new Promise(r => setTimeout(r, 600));
    return { hash: location.hash, match: window.App.state.archive.batchId === b };
  }, made.batchId);
  check('۹) و از پرونده به بایگانی برمی‌گردد',
    caseToArchive.hash === '#/archive' && caseToArchive.match,
    JSON.stringify(caseToArchive));

  const archiveToTasks = await page.evaluate(async () => {
    const card = document.querySelector('.arc-batch-head');
    card.click();
    await new Promise(r => setTimeout(r, 400));
    const btn = [...document.querySelectorAll('.arc-batch-actions button')]
      .find(x => /کار ثبت‌شده/.test(x.textContent));
    if (!btn) return 'دکمهٔ کار روی دسته نبود';
    btn.click();
    await new Promise(r => setTimeout(r, 600));
    return { hash: location.hash, cat: window.App.state.taskCat };
  });
  check('۱۰) و از بایگانی به کارها — رفت‌وبرگشت از هر دو سمت',
    archiveToTasks.hash === '#/tasks' &&
    archiveToTasks.cat === 'بایگانی و اسکن', JSON.stringify(archiveToTasks));

  // ------------------------------------ دامنهٔ کار، در همهٔ شمارش‌ها
  console.log('\n— دامنهٔ کار، یکسان در همهٔ نماها —');

  const scoped = await page.evaluate(async (ids) => {
    const M = window.Model, J = window.J;
    // همان دو پرونده‌ای که سند گرفتند را ارجاع می‌دهیم
    await M.applyPatches(ids.map(id => ({
      id: id, patch: { transferDate: J.today(), transferTo: 'کارشناس دوم' }
    })), { kind: 'edit', note: 'ارجاع آزمایشی' });

    function snapshot() {
      const today = J.today();
      return {
        docs: window.Docs.visibleDocs().length,
        batchDocs: (window.Docs.batches()[0] || { docs: [] }).docs.length,
        search: window.Docs.searchDocs('').length,
        tasks: window.Notes.tasks({ archived: 'any' }).length,
        doneBetween: window.Notes.doneBetween(today, today).length,
        calDoc: window.Calendar.collect(today, today, ['doc']).length,
        calTask: window.Calendar.collect(today, today, ['task']).length,
        karnamehDocs: window.Karnameh.build(today, today, {}).totals.docs,
        karnamehTasks: window.Karnameh.build(today, today, {}).totals.tasksDone,
        cases: M.scoped().length
      };
    }
    const before = snapshot();
    await M.setScope({ hideTransferred: true });
    const after = snapshot();
    await M.setScope({ hideTransferred: false });
    return { before: before, after: after };
  }, made.caseIds);

  const b = scoped.before, a = scoped.after;
  check('بدون دامنه، همه‌چیز شمرده می‌شود',
    b.docs === 10 && b.tasks === 4 && b.karnamehDocs === 10,
    JSON.stringify(b));
  check('با دامنه، سندهای دو پروندهٔ ارجاع‌شده از بایگانی می‌روند',
    a.docs === 8 && a.search === 8 && a.batchDocs === 8,
    b.docs + ' → ' + a.docs);
  check('و کارهایشان از کارها',
    a.tasks === 2 && a.doneBetween === 2, b.tasks + ' → ' + a.tasks);
  /* لایهٔ کار بدون لایهٔ سند سنجیده می‌شود تا کارهای دسته هم شمرده شوند */
  check('و از تقویم', a.calTask === 2, b.calTask + ' → ' + a.calTask);
  check('و کارنامه هم همان را می‌شمرد — نه عددی بیشتر، نه کمتر',
    a.karnamehDocs === a.docs && a.karnamehTasks === a.doneBetween,
    a.karnamehDocs + ' سند، ' + a.karnamehTasks + ' کار');

  // --------------------------------------- بایگانی کار، همه‌جا یکسان
  console.log('\n— کارِ بایگانی‌شده، همه‌جا کنار می‌رود —');
  const arch = await page.evaluate(async () => {
    const N = window.Notes, J = window.J, today = J.today();
    function snap() {
      return {
        tasks: N.tasks({}).length,
        cal: window.Calendar.collect(today, today, ['task']).length,
        karnameh: window.Karnameh.build(today, today, {}).totals.tasksDone
      };
    }
    const before = snap();
    const n = await N.archiveClosed();
    const after = snap();
    return { before: before, after: after, moved: n };
  });
  check('بایگانی کردن، کار را از فهرست و تقویم برمی‌دارد',
    arch.after.tasks === 0 && arch.after.cal === 0,
    JSON.stringify(arch.after));
  check('ولی کارنامه همچنان می‌شمردش — بایگانی دربارهٔ دیده شدن است',
    arch.after.karnameh === arch.before.karnameh,
    arch.before.karnameh + ' → ' + arch.after.karnameh);

  // --------------------------------------------- همهٔ نماها بالا می‌آیند
  console.log('\n— هر هفت نما با همین داده بالا می‌آیند —');
  const views = await page.evaluate(async () => {
    const out = {};
    const go = [
      ['work', '.worklist'], ['list', '.list-layout'], ['tasks', '.tasks-view'],
      ['calendar', '.cal-view'], ['archive', '.arc-view'],
      ['people', '.people-view, .person-list, .list-layout'], ['report', '.report-view']
    ];
    for (const [v, sel] of go) {
      window.App.state.view = v;
      window.App.render();
      await new Promise(r => setTimeout(r, 450));
      out[v] = !!document.querySelector(sel);
    }
    return out;
  });
  check('همهٔ نماها بدون خطا رندر می‌شوند',
    Object.keys(views).every(k => views[k]), JSON.stringify(views));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
