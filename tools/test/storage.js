/*
 * تست ذخیره‌سازی: فایل دیتابیس روی دیسک باید مبنا باشد، نه انبار مرورگر.
 *
 * چیزی که اینجا سنجیده می‌شود همان شکایت واقعی کاربر است: «نسخهٔ تازهٔ
 * برنامه را می‌گذارم و انگار از کش کروم می‌خواند». پس آزمون این است که با
 * خالی شدن کاملِ انبار مرورگر، داده از روی فایل برگردد.
 *
 * اجرا:  node tools/test/storage.js
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

/*
 * یک دیسک ساختگی درون‌حافظه‌ای با همان دو پنجرهٔ واقعی:
 * showSaveFilePicker (ساختن/بازنویسی) و showOpenFilePicker (باز کردن).
 */
const FAKE_DISK = `(function () {
  window.__disk = {};
  window.__handles = {};
  function makeHandle(name) {
    return {
      kind: 'file', name: name,
      queryPermission: function () { return Promise.resolve('granted'); },
      requestPermission: function () { return Promise.resolve('granted'); },
      getFile: function () {
        return Promise.resolve(new File([window.__disk[name] || ''], name,
          { type: 'application/json' }));
      },
      createWritable: function () {
        var parts = [];
        return Promise.resolve({
          write: function (d) { parts.push(d); return Promise.resolve(); },
          close: function () {
            return new Blob(parts).text().then(function (t) {
              window.__disk[name] = t;
            });
          }
        });
      }
    };
  }
  function handleFor(name) {
    if (!window.__handles[name]) window.__handles[name] = makeHandle(name);
    return window.__handles[name];
  }
  window.showSaveFilePicker = function (o) {
    return Promise.resolve(handleFor((o && o.suggestedName) || 'db.json'));
  };
  window.showOpenFilePicker = function () {
    return Promise.resolve([handleFor(window.__pick || 'parvandeha-db.json')]);
  };
})();`;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ||
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await bootApp(page, APP, { settle: 900 });
  await page.evaluate(FAKE_DISK);

  console.log('\n— نوشتن روی فایل —');
  const wrote = await page.evaluate(async () => {
    await window.Store.linkFile();
    await window.Model.create({
      caseNo: '9999001', firstName: 'آزمون', lastName: 'فایل'
    });
    await window.Store.flushNow();
    const text = window.__disk['parvandeha-db.json'] || '';
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* بی‌خیال */ }
    return {
      cases: window.Model.state.cases.length,
      bytes: text.length,
      app: parsed && parsed.app,
      inFile: !!(parsed && (parsed.cases || []).some(c => c.caseNo === '9999001')),
      linked: window.Store.status().linked
    };
  });
  check('اتصال به فایل برقرار شد و محتوا نوشته شد',
    wrote.linked && wrote.bytes > 1000 && wrote.app === 'parvandeha',
    wrote.bytes + ' بایت');
  check('پروندهٔ تازه داخل خودِ فایل هست، نه فقط در مرورگر', wrote.inFile);

  console.log('\n— انبار مرورگر پاک شود، فایل باید برگرداند —');
  const adopted = await page.evaluate(async () => {
    await window.Store.clearAll();          // شبیه‌سازی پاک شدن دادهٔ مرورگر
    await window.Model.reload();
    const empty = window.Model.state.cases.length;
    const ok = await window.Store.adoptFile();
    await window.Model.reload();
    return {
      empty: empty, adopted: ok,
      now: window.Model.state.cases.length,
      kept: window.Model.state.cases.some(c => c.caseNo === '9999001')
    };
  });
  check('با خالی شدن مرورگر، داده‌ها از فایل برمی‌گردند',
    adopted.empty === 0 && adopted.adopted === true && adopted.now > 1 && adopted.kept,
    adopted.empty + ' → ' + adopted.now + ' پرونده');

  console.log('\n— باز کردن دیتابیس موجود —');
  const opened = await page.evaluate(async () => {
    await window.Store.clearAll();
    await window.Model.reload();
    const before = window.Model.state.cases.length;
    const res = await window.Store.openFile();
    await window.Model.reload();
    return { before: before, reported: res.cases, now: window.Model.state.cases.length };
  });
  check('«باز کردن دیتابیس موجود» فایل را می‌خوانَد، نه اینکه بازنویسی کند',
    opened.before === 0 && opened.reported === opened.now && opened.now > 1,
    opened.now + ' پرونده');

  const rejected = await page.evaluate(async () => {
    window.__disk['other.json'] = '{"app":"something-else"}';
    window.__pick = 'other.json';
    try { await window.Store.openFile(); return ''; }
    catch (e) { return e.message; }
  });
  check('فایلی که دیتابیس این برنامه نیست، رد می‌شود',
    /دیتابیس این برنامه نیست/.test(rejected), rejected);

  console.log('\n— فایل کهنه، دادهٔ تازه‌تر را خراب نکند —');
  const stale = await page.evaluate(async () => {
    window.__pick = 'parvandeha-db.json';
    await window.Store.openFile();           // برگشت به فایل درست
    await window.Model.reload();
    // یک پروندهٔ تازه بساز ولی روی فایل ننویس؛ یعنی مرورگر جلوتر است
    await window.Model.create({
      caseNo: '9999002', firstName: 'تازه‌تر', lastName: 'از فایل'
    });
    const before = window.Model.state.cases.length;
    const took = await window.Store.adoptFile();
    await window.Model.reload();
    return {
      took: took, before: before, after: window.Model.state.cases.length,
      kept: window.Model.state.cases.some(c => c.caseNo === '9999002')
    };
  });
  check('فایلِ قدیمی‌تر جای دادهٔ تازه‌تر را نمی‌گیرد',
    stale.took === false && stale.kept && stale.after === stale.before,
    stale.before + ' → ' + stale.after);

  // ---------------------------------------------------------------------
  console.log('\n— رمز با خودِ فایل سفر می‌کند —');

  const sealed = await page.evaluate(async () => {
    window.__pick = 'parvandeha-db.json';
    await window.Store.setPassword('Ramz-1404!');
    await window.Store.flushNow();
    const text = window.__disk['parvandeha-db.json'];
    const payload = JSON.parse(text);
    return {
      encrypted: !!payload.encrypted,
      hasSalt: !!(payload.kdf && payload.kdf.salt),
      hasVerifier: !!payload.verifier,
      // نام و شمارهٔ پرونده نباید در فایل خوانا باشد
      leaks: /9999001|آزمون/.test(text),
      iterations: payload.kdf && payload.kdf.iterations
    };
  });
  check('فایل روی دیسک واقعاً رمز می‌شود',
    sealed.encrypted && sealed.hasSalt && sealed.hasVerifier && !sealed.leaks,
    sealed.iterations + ' دور PBKDF2');

  /* مهم‌ترین سنجه: مرورگرِ تازه. انبار و پیکربندی رمز را کامل پاک می‌کنیم،
     یعنی همان وضعیتی که برنامه در فایرفاکس یا رایانهٔ دیگری دارد. */
  const otherBrowser = await page.evaluate(async () => {
    await window.Store.clearAll();
    window.Vault.clearPassword();
    window.Vault.configure(null);
    await window.Model.reload();
    // کاربر پنجرهٔ رمز را می‌بندد (انصراف)
    window.Store.onPasswordNeeded(function () { return Promise.resolve(null); });
    let noPass = '';
    try { await window.Store.openFile(); }
    catch (e) { noPass = e.message; }
    return { cases: window.Model.state.cases.length, error: noPass };
  });
  check('در مرورگر تازه، فایلِ رمزدار بدون رمز باز نمی‌شود',
    otherBrowser.cases === 0 && /رمز/.test(otherBrowser.error), otherBrowser.error);

  const wrongPw = await page.evaluate(async () => {
    window.Store.onPasswordNeeded(function () { return Promise.resolve('غلط-است'); });
    let err = '';
    try { await window.Store.openFile(); } catch (e) { err = e.message; }
    return { cases: window.Model.state.cases.length, error: err };
  });
  check('رمز نادرست، فایل را باز نمی‌کند',
    wrongPw.cases === 0 && /رمز نادرست/.test(wrongPw.error), wrongPw.error);

  const rightPw = await page.evaluate(async () => {
    window.Store.onPasswordNeeded(function () { return Promise.resolve('Ramz-1404!'); });
    const res = await window.Store.openFile();
    await window.Model.reload();
    return {
      reported: res.cases,
      cases: window.Model.state.cases.length,
      // رمزِ فایل باید روی این مرورگر هم نشسته باشد
      encrypted: window.Store.status().encrypted,
      kept: window.Model.state.cases.some(c => c.caseNo === '9999001')
    };
  });
  check('با رمز درست باز می‌شود و داده‌ها برمی‌گردند',
    rightPw.cases > 1 && rightPw.kept, rightPw.cases + ' پرونده');
  check('رمزِ فایل روی این مرورگر هم می‌نشیند، پس دفعهٔ بعد قفل می‌آید',
    rightPw.encrypted === true);

  console.log('\n— نوار اجازهٔ دسترسی —');
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.access-bar');
    return { shown: !!b, text: b ? b.textContent : '' };
  });
  check('وقتی همه‌چیز وصل است، نوار اجازه دیده نمی‌شود', !bar.shown, bar.text);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
