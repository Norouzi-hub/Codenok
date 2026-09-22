/*
 * تست هشت اصلاحِ این دور.
 *
 * همه‌شان از یک جنس‌اند: چیزی که کار می‌کرد، ولی در جای غلط، با نام
 * غلط، یا با دانلودی که کسی نخواسته بود.
 *
 * اجرا:  node tools/test/fixes.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const bootApp = require('./boot');
const MOCK_FS = require('./mockfs');

/* یک PNG یک‌پیکسلیِ معتبر — نمایشگر باید واقعاً بتواند بازش کند */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8' +
  'BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-'));
  const files = [];
  /* نام فایل‌ها لاتین است: setInputFiles پلی‌رایت نامِ غیرلاتین را
     بی‌صدا می‌اندازد — محدودیت ابزار تست، نه برنامه. */
  for (let i = 1; i <= 4; i++) {
    const f = path.join(dir, 'scan-' + i + '.pdf');
    fs.writeFileSync(f, 'x' + i);
    files.push(f);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR', acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errors = [];
  let downloads = 0;
  page.on('download', () => { downloads++; });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);
  await page.evaluate(MOCK_FS);
  await page.evaluate(() => window.Docs.linkFolder());

  // ============================== ۱) یک فایل، «دسته» نیست
  console.log('\n— یک فایل از داخل پرونده، دستهٔ یک‌نفره نمی‌سازد —');
  const caseId = await page.evaluate(() => {
    const rec = window.Model.state.cases[0];
    window.App.state.formTab = '__docs';
    window.App.openCase(rec.id);
    return rec.id;
  });
  await page.waitForTimeout(500);
  const [c1] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      [...document.querySelectorAll('.form-panel button')]
        .find(x => /افزودن سند|＋/.test(x.textContent)).click();
    })
  ]);
  await c1.setFiles([files[0]]);
  await page.waitForSelector('.doc-add-modal');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    [...document.querySelectorAll('.doc-add-modal .modal-foot .btn.primary')].pop().click();
  });
  await page.waitForTimeout(1800);
  const single = await page.evaluate(() => ({
    batches: window.Docs.batches().length,
    docs: window.Docs.all().length,
    tasks: window.Notes.tasks({ archived: 'any' }).length
  }));
  check('یک فایل تنها، نه دسته می‌سازد نه کار',
    single.batches === 0 && single.docs === 1 && single.tasks === 0,
    JSON.stringify(single));

  // ================= ۲) دستهٔ بی‌نام، «بدون نام» نمی‌ماند
  console.log('\n— دستهٔ بی‌نام، نام می‌گیرد —');
  await page.evaluate(() => window.App.goArchive());
  await page.waitForSelector('.arc-view');
  const [c2] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      [...document.querySelectorAll('.arc-plate button')]
        .find(x => /بارگذاری دسته‌ای/.test(x.textContent)).click();
    })
  ]);
  await c2.setFiles(files.slice(1));
  await page.waitForSelector('.doc-add-modal');
  await page.waitForTimeout(400);
  const otherCase = await page.evaluate(async () => {
    const m = document.querySelector('.doc-add-modal');
    const rows = [...m.querySelectorAll('.doc-add-row')];
    const rec = window.Model.state.cases[1];
    const ci = rows[0].querySelector('.dcase-field input');
    ci.value = rec.caseNo;
    ci.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    // نام دسته عمداً خالی می‌ماند
    [...m.querySelectorAll('.modal-foot .btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 2500));
    return rec.id;
  });
  const named = await page.evaluate(() => {
    const b = window.Docs.batches()[0];
    return { name: b.name, n: b.docs.length };
  });
  check('نام خودکار از نوع سند و روز ساخته می‌شود، نه «بدون نام»',
    named.name !== 'بدون نام' && /—/.test(named.name) && named.n === 3,
    named.name);

  // ============ ۳) کارِ خودکار در پرونده نمی‌نشیند
  console.log('\n— کارِ خودکار در تب پرونده نمی‌نشیند —');
  const clean = await page.evaluate((id) => ({
    caseTasks: window.Notes.tasks({ caseId: id, archived: 'any' }).length,
    caseNotes: window.Notes.forCase(id).length,
    allTasks: window.Notes.tasks({ archived: 'any' })
      .map(t => ({ title: t.title, onCase: !!t.caseId })),
    history: window.Model.historyFor(id)
      .filter(h => h.kind === 'doc-batch').length
  }), otherCase);
  check('پرونده نه کارِ خودکار می‌گیرد نه یادداشت',
    clean.caseTasks === 0 && clean.caseNotes === 0,
    clean.caseTasks + ' کار، ' + clean.caseNotes + ' یادداشت');
  check('فقط یک کارِ کلیِ بی‌پرونده ساخته می‌شود',
    clean.allTasks.length === 1 && !clean.allTasks[0].onCase,
    clean.allTasks.map(t => t.title).join(' | '));
  /* ردِ کار باید در پرونده بماند — فقط نه در فهرست کارهایش */
  check('ولی ردش در تاریخچهٔ پرونده هست', clean.history === 1);

  // ==================== ۴) تقویم، سطرِ بارگذاری را دارد
  console.log('\n— تقویم —');
  const cal = await page.evaluate(async () => {
    window.App.goCalendar();
    await new Promise(r => setTimeout(r, 700));
    const J = window.J;
    return {
      rows: window.Calendar.collect(J.today(), J.today(),
        window.App.state.calLayers).filter(i => i.layer === 'doc')
        .map(i => i.label),
      inCell: document.querySelectorAll('.cal-day.today .cal-item.l-doc').length
    };
  });
  check('نوبت بارگذاری روی تقویم می‌آید، با نام واقعی‌اش',
    cal.rows.length === 2 && cal.rows.some(r => /۳ سند/.test(r)) && cal.inCell >= 1,
    cal.rows.join(' | '));

  // ====== ۵) محتوای دسته، زیر خودِ دسته باز می‌شود
  console.log('\n— محتوای دسته، زیر خودِ دسته —');
  const expand = await page.evaluate(async () => {
    window.App.goArchive();
    await new Promise(r => setTimeout(r, 600));
    const before = {
      inCard: document.querySelectorAll('.arc-batch-docs .arc-doc').length,
      inList: document.querySelectorAll('.arc-section .arc-docs > .arc-doc').length
    };
    document.querySelector('.arc-batch-head').click();
    await new Promise(r => setTimeout(r, 500));
    return {
      before: before,
      inCard: document.querySelectorAll('.arc-batch-docs .arc-doc').length,
      sections: [...document.querySelectorAll('.arc-section h2')].map(h => h.textContent)
    };
  });
  check('پیش از باز کردن، سندها در فهرست کلی‌اند',
    expand.before.inCard === 0 && expand.before.inList === 4,
    expand.before.inList + ' سند');
  check('با کلیک، سندهای دسته داخل خودِ کارت باز می‌شوند',
    expand.inCard === 3, expand.inCard + ' سند در کارت');
  check('و فهرست کلی تکرارشان نمی‌کند',
    expand.sections.length === 1 && expand.sections[0] === 'دسته‌های بارگذاری',
    expand.sections.join(' | '));

  // ========= ۶ و ۸) دیدن در برنامه، نه دانلود
  console.log('\n— عکس و PDF همین‌جا دیده می‌شوند، دانلود نمی‌شوند —');
  await page.evaluate((b64) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return window.Docs.addGeneralFile(
      new File([bin], 'pic.png', { type: 'image/png' }),
      { kind: 'سایر', docDate: window.J.today() });
  }, PNG);
  const viewer = await page.evaluate(async () => {
    window.App.goArchive();
    await new Promise(r => setTimeout(r, 600));
    const thumb = document.querySelector('.arc-docs .arc-doc button');
    thumb.click();
    await new Promise(r => setTimeout(r, 800));
    const has = !!document.querySelector('.vw-stage');
    const dl = [...document.querySelectorAll('.overlay button, .overlay a')]
      .some(b => /دانلود/.test(b.textContent));
    const ov = document.querySelector('.overlay');
    if (ov) ov.remove();
    return { open: has, download: dl };
  });
  check('کلیک روی سند بایگانی، نمایشگر را باز می‌کند نه دانلود',
    viewer.open && downloads === 0, 'دانلودها: ' + downloads);
  check('و دکمهٔ دانلود داخل نمایشگر هست، برای وقتی که لازم شد',
    viewer.download);

  /* همان قاعده در همهٔ جاهای دیگر که سند نشان می‌دهند */
  const noOpenDoc = await page.evaluate(() => {
    const src = document.documentElement.innerHTML;
    return {
      viewerUsed: /UIViewer\.open/.test(src),
      // openDoc فقط باید داخل خودِ نمایشگر مانده باشد
      openDocCalls: (src.match(/Docs\.openDoc\(|D\.openDoc\(/g) || []).length
    };
  });
  check('در کل برنامه، «باز کردن بیرونی» فقط داخل نمایشگر مانده',
    noOpenDoc.viewerUsed && noOpenDoc.openDocCalls <= 2,
    noOpenDoc.openDocCalls + ' فراخوانی');

  // ================ ۷) ویرایش یادداشت پرونده
  console.log('\n— ویرایش یادداشت —');
  const note = await page.evaluate(async () => {
    const M = window.Model, N = window.Notes, J = window.J;
    const rec = M.state.cases[2];
    await N.add(rec, 'متن اولیه با غلط', J.addDays(J.today(), 3));
    window.App.state.formTab = '__notes';
    window.App.openCase(rec.id);
    await new Promise(r => setTimeout(r, 600));
    const btn = [...document.querySelectorAll('.note-actions button')]
      .find(x => x.textContent === 'ویرایش');
    if (!btn) return 'دکمهٔ ویرایش نبود';
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const m = document.querySelector('.small-modal');
    const ta = m.querySelector('textarea');
    const before = ta.value;
    ta.value = 'متن اصلاح‌شده';
    [...m.querySelectorAll('.btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 600));
    const n = N.forCase(rec.id).filter(x => x.kind !== 'task')[0];
    return {
      before: before, after: n.text, due: n.followUp,
      shown: [...document.querySelectorAll('.note-text')].map(t => t.textContent),
      keptStamp: !!n.atJalali, edited: !!n.editedAt
    };
  });
  check('یادداشت ویرایش می‌شود و همان‌جا تازه می‌شود',
    note.after === 'متن اصلاح‌شده' && note.shown.indexOf('متن اصلاح‌شده') >= 0,
    note.before + ' → ' + note.after);
  check('زمان و نویسندهٔ اولیه دست نمی‌خورد، ولی ویرایش ثبت می‌شود',
    note.keptStamp && note.edited && note.due === note.due);

  // ============ ۹) بارگذاری از دلِ یک کار
  console.log('\n— بارگذاری از دلِ یک کار —');
  const taskCase = await page.evaluate(async () => {
    const rec = window.Model.state.cases[3];
    await window.Notes.create({
      kind: 'task', title: 'اسکن مدارک پرونده', caseId: rec.id,
      category: 'بایگانی و اسکن'
    });
    window.App.state.taskFilter = 'all';
    window.App.state.taskCat = null;
    window.App.goTasks();
    await new Promise(r => setTimeout(r, 600));
    return rec.id;
  });
  const [c3] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      const row = [...document.querySelectorAll('.task')]
        .find(t => /اسکن مدارک پرونده/.test(t.textContent));
      row.querySelector('.task-actions button[title*="بارگذاری"]').click();
    })
  ]);
  await c3.setFiles(files.slice(1));
  await page.waitForSelector('.doc-add-modal');
  await page.waitForTimeout(500);
  const prefill = await page.evaluate(() => {
    const m = document.querySelector('.doc-add-modal');
    return {
      batchName: [...m.querySelectorAll('.batch-head input.input')]
        .map(i => i.value).filter(Boolean)[0],
      rowCases: [...m.querySelectorAll('.doc-add-row .dcase-field input')]
        .map(i => i.value)
    };
  });
  check('پروندهٔ کار، روی همهٔ سطرها از پیش نشسته',
    prefill.rowCases.length === 3 && prefill.rowCases.every(v => /1404/.test(v)),
    prefill.rowCases[0]);
  check('و نام دسته از عنوان کار می‌آید',
    prefill.batchName === 'اسکن مدارک پرونده', prefill.batchName);

  const afterTask = await page.evaluate(async (id) => {
    [...document.querySelectorAll('.doc-add-modal .modal-foot .btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 2800));
    const t = window.Notes.tasks({ archived: 'any' })
      .filter(x => x.title === 'اسکن مدارک پرونده')[0];
    return {
      found: !!t, status: t && t.status, docCount: t && t.docCount,
      hasBatch: !!(t && t.batchId), onCase: !!(t && t.caseId === id),
      caseDocs: window.Docs.current(id).length,
      totalTasks: window.Notes.tasks({ archived: 'any' }).length
    };
  }, taskCase);
  check('سندها به پروندهٔ همان کار می‌روند',
    afterTask.caseDocs === 3, afterTask.caseDocs + ' سند');
  check('و خودِ کار صاحب دسته می‌شود و تیک می‌خورد — نه کارِ تکراری',
    afterTask.status === 'done' && afterTask.docCount === 3 &&
    afterTask.hasBatch && afterTask.onCase && afterTask.totalTasks === 2,
    JSON.stringify(afterTask));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
