/*
 * تست دودی: برنامه را در کرومیوم روی file:// باز می‌کند و مسیرهای اصلی را می‌آزماید.
 * اجرا:  node tools/test/smoke.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'parvandeha-test-'));

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
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); d.accept(); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  console.log('\n— بارگذاری —');
  await page.goto(APP);
  await page.waitForSelector('.tr', { timeout: 15000 });

  const mode = await page.evaluate(() => window.Store.status().mode);
  check('انبار داده روی file:// کار می‌کند', mode === 'idb', 'mode=' + mode);

  const count = await page.evaluate(() => window.Model.state.cases.length);
  check('۳۱ پروندهٔ نمونه وارد شد', count === 31, 'count=' + count);

  const fieldCount = await page.evaluate(() => window.FIELDS.length);
  check('هر ۶۹ فیلد تعریف شده', fieldCount === 69, 'fields=' + fieldCount);

  console.log('\n— جستجو —');
  await page.fill('.search', 'حراست');
  await page.waitForTimeout(350);
  let shown = await page.evaluate(() => window.App.state.lastResult.length);
  check('جستجوی متنی نتیجه می‌دهد', shown > 0 && shown < 31, 'نتایج=' + shown);

  await page.fill('.search', 'مفتوح');
  await page.waitForTimeout(350);
  shown = await page.evaluate(() => window.App.state.lastResult.length);
  check('جستجو روی وضعیت', shown > 0, 'نتایج=' + shown);

  // یکدست‌سازی حروف: «شهرداري» با ی عربی در برابر «شهرداری»
  await page.fill('.search', 'شهرداري');
  await page.waitForTimeout(350);
  const arabicHit = await page.evaluate(() => window.App.state.lastResult.length);
  await page.fill('.search', 'شهرداری');
  await page.waitForTimeout(350);
  const persianHit = await page.evaluate(() => window.App.state.lastResult.length);
  check('ی/ک عربی و فارسی یکسان جستجو می‌شوند',
    arabicHit === persianHit && persianHit > 0, arabicHit + ' == ' + persianHit);

  await page.fill('.search', '');
  await page.waitForTimeout(300);

  console.log('\n— فیلتر —');
  await page.evaluate(() => {
    window.App.state.filters = { status: ['مفتوح رسیدگی'] };
    window.App.refresh(true);
  });
  await page.waitForTimeout(200);
  const filtered = await page.evaluate(() =>
    window.App.state.lastResult.every(r => r.status === 'مفتوح رسیدگی'));
  check('فیلتر وضعیت درست عمل می‌کند', filtered);
  await page.evaluate(() => { window.App.state.filters = {}; window.App.refresh(true); });
  await page.waitForTimeout(200);

  console.log('\n— ویرایش و تاریخچه —');
  await page.click('.tr');
  await page.waitForSelector('.case-view');
  const title = await page.textContent('.case-title');
  check('پرونده باز شد', /پروندهٔ/.test(title), title.trim());

  // تغییر وضعیت پرونده
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.field'));
    const f = labels.find(l => l.querySelector('.field-label').textContent.includes('وضعیت پرونده'));
    const sel = f.querySelector('select');
    sel.value = 'ابلاغ و مختومه شد';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('.case-actions .btn:last-child');
  await page.waitForTimeout(400);

  const hist = await page.evaluate(() => {
    const id = window.App.state.caseId;
    const h = window.Model.historyFor(id);
    const last = h[h.length - 1];
    return { n: h.length, kind: last.kind, changes: last.changes };
  });
  check('تغییر در تاریخچه ثبت شد',
    hist.kind === 'update' && hist.changes.length === 1 &&
    hist.changes[0].to === 'ابلاغ و مختومه شد',
    JSON.stringify(hist.changes[0] || {}));

  // تایم‌لاین
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.tab'))
      .find(t => t.textContent.includes('تاریخچه')).click();
  });
  await page.waitForSelector('.timeline');
  const tlCount = await page.evaluate(() => document.querySelectorAll('.tl-item').length);
  check('تایم‌لاین رویدادها رندر شد', tlCount >= 2, 'رویداد=' + tlCount);

  console.log('\n— تاریخ شمسی —');
  const dateOk = await page.evaluate(() => {
    return {
      parse: window.J.parse('۱۴۰۴/۰۹/۰۱'),
      fmt: window.J.format('14040901', { latin: true }),
      today: window.J.today().length
    };
  });
  check('تاریخ شمسی با ارقام فارسی خوانده می‌شود',
    dateOk.parse === '14040901' && dateOk.fmt === '1404/09/01' && dateOk.today === 8,
    JSON.stringify(dateOk));

  console.log('\n— پروندهٔ جدید —');
  await page.evaluate(() => window.App.newCase());
  await page.waitForSelector('.field-grid');
  const setField = (label, val) => page.evaluate(([label, val]) => {
    const f = Array.from(document.querySelectorAll('.field'))
      .find(l => l.querySelector('.field-label').textContent.trim() === label);
    if (!f) throw new Error('فیلد پیدا نشد: ' + label);
    const input = f.querySelector('input, textarea');
    input.value = val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [label, val]);

  const openTab = (name) => page.evaluate((name) => {
    Array.from(document.querySelectorAll('.tab'))
      .find(t => t.textContent.includes(name)).click();
  }, name);

  await setField('شماره پرونده', '1405999');
  await openTab('مشخصات فرد');
  await setField('نام', 'آزمون');
  await setField('نام خانوادگی', 'تستی');
  await setField('کد ملی', '0099887766');
  await page.click('.case-actions .btn:last-child');
  await page.waitForTimeout(400);
  const created = await page.evaluate(() =>
    window.Model.state.cases.filter(c => c.caseNo === '1405999').length);
  check('پروندهٔ جدید ثبت شد', created === 1, 'count=' + created);

  console.log('\n— خروجی‌ها —');
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr');

  const dlXlsx = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate(() => window.UIMisc.exportExcel(window.Model.state.cases))
  ]);
  const xlsxPath = path.join(OUT, 'export.xlsx');
  await dlXlsx[0].saveAs(xlsxPath);
  const xlsxSize = fs.statSync(xlsxPath).size;
  check('فایل اکسل ساخته شد', xlsxSize > 5000, xlsxSize + ' بایت');

  const dlSqlite = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.evaluate(() => window.UIMisc.exportSqlite())
  ]);
  const sqlitePath = path.join(OUT, 'export.sqlite');
  await dlSqlite[0].saveAs(sqlitePath);
  const head = fs.readFileSync(sqlitePath).slice(0, 15).toString('latin1');
  check('فایل SQLite ساخته شد', head.startsWith('SQLite format 3'),
    fs.statSync(sqlitePath).size + ' بایت');

  const dlJson = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.UIMisc.exportJson())
  ]);
  const jsonPath = path.join(OUT, 'backup.json');
  await dlJson[0].saveAs(jsonPath);
  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  check('پشتیبان JSON کامل است',
    backup.cases.length === 32 && backup.history.length > 31,
    backup.cases.length + ' پرونده، ' + backup.history.length + ' رویداد');

  console.log('\n— ورود مجدد از اکسل —');
  const importResult = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const rows = await window.XLSX.read(bytes.buffer);
    return { rows: rows.length, cols: rows[0].length, firstHeader: rows[0][0],
      sample: rows[1] ? rows[1][0] : null };
  }, fs.readFileSync(xlsxPath).toString('base64'));
  check('فایل اکسل دوباره خوانده می‌شود',
    importResult.rows === 33 && importResult.cols === 69 &&
    importResult.firstHeader.includes('شماره پرونده'),
    JSON.stringify(importResult));

  console.log('\n— ماندگاری داده پس از بستن صفحه —');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('.tr', { timeout: 15000 });
  const afterReload = await page.evaluate(() => ({
    cases: window.Model.state.cases.length,
    hasNew: window.Model.state.cases.some(c => c.caseNo === '1405999'),
    history: window.Model.state.history.length
  }));
  check('داده‌ها پس از رفرش باقی ماندند',
    afterReload.cases === 32 && afterReload.hasNew && afterReload.history > 31,
    JSON.stringify(afterReload));

  console.log('\n— کارایی با ۵۰۰ پرونده —');
  const perf = await page.evaluate(async () => {
    const base = window.Model.state.cases[0];
    const bulk = [];
    for (let i = 0; i < 500; i++) {
      const rec = Object.assign({}, base);
      delete rec.id;
      rec.caseNo = '1406' + String(i).padStart(4, '0');
      rec.lastName = 'آزمون' + i;
      bulk.push(rec);
    }
    const t0 = performance.now();
    await window.Model.bulkImport(bulk, 'تست کارایی');
    const tImport = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) {
      window.Model.query({ q: 'آزمون' + i, filters: {}, sortKey: 'caseNo', sortDir: 'asc' });
    }
    const tSearch = (performance.now() - t1) / 20;
    const t2 = performance.now();
    window.App.refresh();
    const tRender = performance.now() - t2;
    return { total: window.Model.state.cases.length, tImport, tSearch, tRender };
  });
  check('۵۰۰ پرونده وارد شد', perf.total >= 532, 'total=' + perf.total);
  check('میانگین زمان جستجو زیر ۲۰ms', perf.tSearch < 20, perf.tSearch.toFixed(2) + 'ms');
  check('رندر جدول زیر ۲۵۰ms', perf.tRender < 250, perf.tRender.toFixed(1) + 'ms');

  const rendered = await page.evaluate(() => document.querySelectorAll('.tr').length);
  check('رندر مجازی فعال است (ردیف‌های کم در DOM)', rendered < 60,
    rendered + ' ردیف در DOM از ' + perf.total);

  console.log('\n— چاپ —');
  await page.evaluate(() => {
    window.print = () => {};
    window.UIPrint.printCase(window.Model.state.cases[0]);
  });
  const printSections = await page.evaluate(() =>
    document.querySelectorAll('#print-area .p-section').length);
  check('برگ چاپ پرونده ساخته شد', printSections >= 3, 'بخش=' + printSections);

  await page.evaluate(() => window.UIPrint.printList(window.Model.state.cases.slice(0, 20)));
  const printRows = await page.evaluate(() =>
    document.querySelectorAll('#print-area .p-list tr').length);
  check('فهرست چاپی ساخته شد', printRows === 21, 'سطر=' + printRows);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
