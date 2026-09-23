/*
 * تست رمز عبور و رمزنگاری داده‌ها.
 * اجرا:  node tools/test/lock.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const bootApp = require('./boot');
const PW = 'Komite@1405';

const w = { toFa: n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) };

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/** رکوردهای خام IndexedDB را بدون واسطهٔ برنامه می‌خواند */
const RAW_READ = `
new Promise(function (resolve, reject) {
  var req = indexedDB.open('parvandeha');
  req.onerror = function () { reject(req.error); };
  req.onsuccess = function () {
    var db = req.result;
    var t = db.transaction(['cases'], 'readonly');
    var all = t.objectStore('cases').getAll();
    all.onsuccess = function () {
      var rows = all.result || [];
      db.close();
      resolve({
        count: rows.length,
        sealed: rows.filter(function (r) { return !!r.__enc; }).length,
        plainKeys: rows.length ? Object.keys(rows[0]) : [],
        blob: JSON.stringify(rows).slice(0, 400000)
      });
    };
    all.onerror = function () { reject(all.error); };
  };
})
`;


/** صفحهٔ نخست حالا کارتابل است؛ تست‌ها با فهرست پرونده‌ها کار می‌کنند */
async function openList(page) {
  await page.waitForSelector('.worklist, .lock-screen, .tr', { timeout: 20000 });
  if (await page.$('.lock-screen')) return;
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr', { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);
  await openList(page);

  console.log('\n— پیش از تعیین رمز —');
  const before = await page.evaluate(RAW_READ);
  check('بدون رمز، داده‌ها به شکل ساده ذخیره‌اند',
    before.sealed === 0 && before.blob.indexOf('غلامستان') >= 0,
    before.count + ' رکورد');
  check('صفحهٔ قفل نشان داده نمی‌شود',
    !(await page.evaluate(() => window.UILock.isShowing())));

  console.log('\n— تعیین رمز —');
  const nameInData = await page.evaluate(() => window.Model.state.cases[0].lastName);
  const set = await page.evaluate(async (pw) => {
    const t0 = performance.now();
    await window.Store.setPassword(pw);
    const cfg = window.Vault.getConfig();
    return {
      ms: Math.round(performance.now() - t0), st: window.Store.status(),
      iterations: cfg.iterations, saltBits: atob(cfg.salt).length * 8
    };
  }, PW);
  check('رمز تنظیم شد', set.st.encrypted, set.ms + 'ms برای رمزنگاری کل داده');
  // زمان اجرا روی ماشین‌های مختلف فرق می‌کند؛ خودِ ویژگی را می‌سنجیم
  check('مشتق‌سازی کلید با دورِ بالا انجام می‌شود (ضد حدس زدن)',
    set.iterations >= 300000 && set.saltBits >= 128,
    w.toFa(set.iterations) + ' دور، نمک ' + set.saltBits + ' بیتی');

  const after = await page.evaluate(RAW_READ);
  check('همهٔ رکوردهای پرونده رمز شدند',
    after.sealed === after.count && after.count > 0,
    after.sealed + ' از ' + after.count);
  check('متن پرونده‌ها دیگر در دیتابیس خوانا نیست',
    after.blob.indexOf('غلامستان') < 0 && after.blob.indexOf(nameInData) < 0);
  check('فقط شناسه و بستهٔ رمزشده بیرون می‌مانند',
    JSON.stringify(after.plainKeys.sort()) === JSON.stringify(['__enc', 'id']),
    after.plainKeys.join(', '));

  console.log('\n— کار کردن با قفلِ باز —');
  const stillWorks = await page.evaluate(async () => {
    const rec = await window.Model.create({
      caseNo: '1409500', firstName: 'رمز', lastName: 'آزما',
      status: 'مفتوح رسیدگی', intakeDate: '14050101'
    });
    return {
      id: rec.id,
      // «ازما» زیررشتهٔ «سازمان» است؛ کوئری باید یکتا باشد
      found: window.Model.query({ q: '1409500', filters: {} }).length,
      byName: window.Model.query({ q: 'رمز آزما', filters: {} }).length,
      total: window.Model.state.cases.length,
      blob: (window.Model.get(rec.id) || {})._blob
    };
  });
  check('ثبت و جستجو با رمز فعال کار می‌کند',
    stillWorks.found === 1 && stillWorks.byName === 1,
    'با شماره: ' + stillWorks.found + ' • با نام: ' + stillWorks.byName);

  console.log('\n— بستن و باز کردن دوباره —');
  await page.reload();
  await page.waitForSelector('.lock-screen', { timeout: 15000 });
  const locked = await page.evaluate(() => ({
    shown: window.UILock.isShowing(),
    cases: window.Model.state.cases.length,
    topBarHidden: (document.querySelector('.topbar') || {}).style
      ? document.querySelector('.topbar').style.display === 'none' : false,
    hasRows: document.querySelectorAll('.tr').length
  }));
  check('پس از باز شدن دوباره، صفحهٔ قفل می‌آید', locked.shown);
  check('هیچ داده‌ای پیش از رمز در حافظه نیست',
    locked.cases === 0 && locked.hasRows === 0,
    locked.cases + ' پرونده در حافظه');
  check('نوار بالا تا باز شدن قفل پنهان است', locked.topBarHidden);

  console.log('\n— رمز نادرست —');
  await page.fill('.lock-input', 'رمز-غلط');
  await page.click('.lock-box .btn.primary');
  await page.waitForTimeout(1200);
  const wrong = await page.evaluate(() => ({
    still: window.UILock.isShowing(),
    msg: (document.querySelector('.lock-msg') || {}).textContent || '',
    cases: window.Model.state.cases.length
  }));
  check('رمز نادرست پذیرفته نمی‌شود',
    wrong.still && wrong.cases === 0 && wrong.msg.indexOf('نادرست') >= 0,
    wrong.msg.trim());

  console.log('\n— رمز درست —');
  await page.fill('.lock-input', PW);
  await page.click('.lock-box .btn.primary');
  await page.waitForSelector('.lock-screen', { state: 'detached', timeout: 25000 });
  await openList(page);
  const opened = await page.evaluate(() => ({
    shown: window.UILock.isShowing(),
    cases: window.Model.state.cases.length,
    newOne: window.Model.state.cases.some(c => c.caseNo === '1409500'),
    topBar: !!document.querySelector('.topbar')
  }));
  check('با رمز درست، داده‌ها باز می‌شوند',
    !opened.shown && opened.cases > 0 && opened.newOne,
    opened.cases + ' پرونده');
  check('نوار بالا برمی‌گردد', opened.topBar);

  console.log('\n— قفل دستی —');
  await page.evaluate(() => window.App.lockNow(false));
  await page.waitForSelector('.lock-screen');
  const relocked = await page.evaluate(() => ({
    shown: window.UILock.isShowing(),
    cases: window.Model.state.cases.length
  }));
  check('قفل دستی، داده‌های حافظه را پاک می‌کند',
    relocked.shown && relocked.cases === 0,
    relocked.cases + ' پرونده در حافظه');
  await page.fill('.lock-input', PW);
  await page.click('.lock-box .btn.primary');
  await page.waitForSelector('.lock-screen', { state: 'detached', timeout: 25000 });
  await openList(page);

  console.log('\n— نسخهٔ پشتیبان رمزشده —');
  const fs = require('fs');
  const os = require('os');
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'parvandeha-lock-'));
  const dl = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate(() => window.UIMisc.exportJson())
  ]);
  const backupPath = path.join(OUT, 'backup.json');
  await dl[0].saveAs(backupPath);
  const raw = fs.readFileSync(backupPath, 'utf8');
  const parsed = JSON.parse(raw);
  check('پشتیبان رمزشده بیرون می‌آید',
    parsed.encrypted === true && !!parsed.data && !!parsed.kdf.salt);
  check('متن پرونده‌ها در فایل پشتیبان خوانا نیست',
    raw.indexOf('غلامستان') < 0 && raw.indexOf('1409500') < 0,
    Math.round(raw.length / 1024) + ' کیلوبایت');

  const roundTrip = await page.evaluate(async ([payload, pw]) => {
    const good = await window.Vault.openSnapshot(payload, pw);
    let badFailed = false;
    try {
      await window.Vault.openSnapshot(payload, pw + 'x');
    } catch (e) { badFailed = true; }
    return {
      cases: good.cases.length, docs: (good.docs || []).length, badFailed: badFailed
    };
  }, [parsed, PW]);
  check('پشتیبان با رمز درست باز می‌شود',
    roundTrip.cases > 0, roundTrip.cases + ' پرونده');
  check('پشتیبان با رمز غلط باز نمی‌شود', roundTrip.badFailed);

  console.log('\n— خروجی اکسل رمز ندارد (عمدی) —');
  const xl = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate(() => window.UIMisc.exportExcel(window.Model.state.cases))
  ]);
  const xlPath = path.join(OUT, 'export.xlsx');
  await xl[0].saveAs(xlPath);
  check('خروجی اکسل ساخته می‌شود و خواناست',
    fs.statSync(xlPath).size > 4000, fs.statSync(xlPath).size + ' بایت');

  console.log('\n— برداشتن رمز —');
  const cleared = await page.evaluate(async () => {
    await window.Store.clearPassword();
    return window.Store.status();
  });
  check('رمز برداشته شد', !cleared.encrypted);
  const afterClear = await page.evaluate(RAW_READ);
  check('داده‌ها دوباره به شکل ساده نوشته شدند',
    afterClear.sealed === 0 && afterClear.blob.indexOf('غلامستان') >= 0,
    afterClear.count + ' رکورد');

  await page.reload();
  await openList(page);
  const finalState = await page.evaluate(() => ({
    locked: window.UILock.isShowing(),
    cases: window.Model.state.cases.length,
    newOne: window.Model.state.cases.some(c => c.caseNo === '1409500')
  }));
  check('پس از برداشتن رمز، بدون قفل بالا می‌آید و داده سالم است',
    !finalState.locked && finalState.cases > 0 && finalState.newOne,
    finalState.cases + ' پرونده');

  console.log('\n— پاک کردن کامل از مرورگر —');
  const dbList = () => page.evaluate(() =>
    indexedDB.databases ? indexedDB.databases().then(d => d.map(x => x.name)) : ['?']);
  const dbBefore = await dbList();
  check('دیتابیس در مرورگر وجود دارد',
    dbBefore.indexOf('parvandeha') >= 0, dbBefore.join(', '));

  await page.evaluate(() => window.Store.wipeBrowser());
  await page.waitForTimeout(600);
  const dbAfter = await dbList();
  check('دیتابیس به‌طور کامل از مرورگر حذف شد',
    dbAfter.indexOf('parvandeha') < 0, dbAfter.join(', ') || 'خالی');
  const lsLeft = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.indexOf('parvandeha') === 0).length);
  check('کلیدهای localStorage هم پاک شدند', lsLeft === 0, lsLeft + ' کلید');

  // «فایل تازه هم داده‌های قبلی را نشان می‌دهد» دیگر نباید رخ دهد
  await page.reload();
  await page.waitForSelector('.start-screen', { timeout: 20000 });
  const gate = await page.evaluate(() => ({
    shown: !!document.querySelector('.start-screen'),
    cases: window.Model.state.cases.length,
    worklist: !!document.querySelector('.worklist')
  }));
  check('پس از پاک کردن، برنامه بدون دیتابیس بالا نمی‌آید',
    gate.shown && !gate.worklist && gate.cases === 0,
    gate.cases + ' پرونده');

  await bootApp(page, APP);
  await openList(page);
  const fresh = await page.evaluate(() => ({
    locked: window.UILock.isShowing(),
    cases: window.Model.state.cases.length,
    encrypted: window.Store.status().encrypted,
    history: window.Model.state.history.length
  }));
  check('پس از انتخاب «دادهٔ نمونه»، از صفر بالا می‌آید',
    !fresh.locked && !fresh.encrypted,
    fresh.cases + ' پرونده، رمز: ' + fresh.encrypted);
  check('داده‌های تازه فقط نمونهٔ اولیه است',
    fresh.cases === 31 && fresh.history === 31,
    fresh.cases + ' پرونده، ' + fresh.history + ' رویداد');

  console.log('\n— سنجش قدرت رمز —');
  const strengths = await page.evaluate(() => ({
    weak: window.UILock.strength('123456'),
    strong: window.UILock.strength('Komite@1405xyz')
  }));
  check('سنجهٔ قدرت رمز کار می‌کند',
    strengths.weak < strengths.strong,
    strengths.weak + ' در برابر ' + strengths.strong);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
