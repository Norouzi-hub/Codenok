/*
 * صفحهٔ سفید — بدترین خطا.
 *
 * برنامه سه جا نوارهای بالا و پایین را پنهان می‌کند: صفحهٔ قفل، صفحهٔ
 * شروع، و لحظهٔ راه‌اندازی. اگر درست همان‌جا چیزی بشکند، کاربر با یک
 * صفحهٔ کاملاً سفید تنها می‌ماند: نه پیامی، نه دکمه‌ای، نه راهی برای
 * گفتن اینکه چه شد.
 *
 * دو نگهبان می‌سنجیم:
 *   ۱) فایلِ ناقص — نسخهٔ تک‌فایلی دست‌به‌دست می‌شود و انتقالِ نصفه یعنی
 *      صفحهٔ سفید؛ در نسخهٔ پوشه‌ای، index.html بی پوشهٔ assets (زیپی که
 *      باز نشده) یا یک فایلِ جاافتاده همان نتیجه را دارد.
 *   ۲) خطای راه‌اندازی — چه در مسیر معمولی، چه در promiseی که رها شده.
 *
 * اجرا:  node tools/test/whitepage.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const DIST = path.resolve(__dirname, '../../dist/nokman/index.html');
const SINGLE = path.resolve(__dirname, '../../dist/nokman.html');
const APP = 'file://' + DIST;

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/** خطایی ساختگی، درست در همان مرحله‌ای که نوارها پنهان‌اند */
function breakAt(layer, fn) {
  return `(() => {
    const t = setInterval(() => {
      if (window.${layer} && window.${layer}.${fn}) {
        clearInterval(t);
        window.${layer}.${fn} = () => Promise.reject(
          new Error('آزمون: ${layer}.${fn} شکست'));
      }
    }, 5);
  })()`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });

  // ============================================== ۱) فایلِ ناقص
  console.log('\n— فایلی که نصفه رسیده —');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-'));
  const cut = path.join(dir, 'nesfe.html');
  const whole = fs.readFileSync(SINGLE);
  fs.writeFileSync(cut, whole.slice(0, Math.floor(whole.length * 0.7)));

  let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + cut);
  await page.waitForTimeout(2000);
  const trunc = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, ' ').trim(),
    marker: !!window.__BUILD_COMPLETE
  }));
  check('فایلِ ناقص، صفحهٔ سفید نمی‌دهد',
    trunc.text.length > 40 && /ناقص/.test(trunc.text),
    trunc.text.slice(0, 60));
  check('و می‌گوید چه باید کرد',
    /دوباره دانلود/.test(trunc.text) && /مگابایت/.test(trunc.text));
  check('نشانهٔ پایانِ فایل در نسخهٔ ناقص نیست', trunc.marker === false);
  await page.close();

  // -------------------------------- index.html تنها، بی پوشهٔ assets
  const alone = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-a-'));
  fs.copyFileSync(DIST, path.join(alone, 'index.html'));
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + path.join(alone, 'index.html'));
  await page.waitForTimeout(1500);
  const lone = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  check('index.html بی assets: می‌گوید زیپ را کامل باز کنید',
    /پیدا نشد/.test(lone) && /Extract/.test(lone) && /assets/.test(lone), lone.slice(0, 80));
  await page.close();

  // ---------------------------------------- یک اسکریپتِ جاافتاده
  const holey = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-h-'));
  fs.cpSync(path.dirname(DIST), holey, { recursive: true });
  fs.rmSync(path.join(holey, 'assets', 'js', 'ui.tasks.js'));
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + path.join(holey, 'index.html'));
  await page.waitForTimeout(1500);
  const hole = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  check('یک فایلِ گم‌شده با نامش گفته می‌شود', /ui\.tasks\.js/.test(hole), hole.slice(0, 120));
  await page.close();

  // -------------------------------------------- فایل کامل، سالم
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(APP);
  await page.waitForTimeout(2000);
  const whole2 = await page.evaluate(() => ({
    marker: !!window.__BUILD_COMPLETE,
    guard: /ناقص/.test(document.body.innerText),
    start: !!document.querySelector('.start-screen')
  }));
  check('فایل کامل، نشانهٔ پایان دارد و نگهبان ساکت است',
    whole2.marker && !whole2.guard && whole2.start,
    JSON.stringify(whole2));
  await page.close();

  // ==================================== ۲) خطا در مسیر راه‌اندازی
  console.log('\n— خطایی که وسط راه‌اندازی می‌افتد —');

  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(new Function(breakAt('Docs', 'load')));
  await page.goto(APP);
  await page.waitForTimeout(1500);
  if (await page.$('.start-demo')) {
    await page.evaluate(() => document.querySelector('.start-demo').click());
    await page.waitForTimeout(3000);
  }
  const fatal = await page.evaluate(() => ({
    shown: !!document.querySelector('.fatal'),
    head: (document.querySelector('.fatal h2') || {}).textContent || '',
    detail: (document.querySelector('.fatal-detail') || {}).textContent || '',
    buttons: [...document.querySelectorAll('.fatal .btn')].map(b => b.textContent),
    topbar: document.querySelector('.topbar')
      ? getComputedStyle(document.querySelector('.topbar')).display : 'MISSING',
    white: document.body.innerText.trim().length < 20
  }));
  check('به‌جای سفیدی، پیام خوانا می‌آید',
    fatal.shown && !fatal.white && /بالا نیامد/.test(fatal.head), fatal.head);
  check('متن فنیِ خطا برای فرستادن هست',
    /Docs\.load شکست/.test(fatal.detail), fatal.detail.slice(0, 70));
  check('نوار بالا برمی‌گردد، کاربر در بن‌بست نمی‌ماند',
    fatal.topbar !== 'none' && fatal.topbar !== 'MISSING', fatal.topbar);
  check('سه راهِ بیرون آمدن هست',
    fatal.buttons.length === 3 && /کپی/.test(fatal.buttons[0]),
    fatal.buttons.join(' | '));

  const copied = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.fatal .btn')]
      .find(x => /کپی/.test(x.textContent));
    b.click();
    return !!document.querySelector('.toast');
  });
  check('دکمهٔ کپی کار می‌کند', copied);
  await page.close();

  // ============================ ۳) خطا بعد از باز شدن قفل (promiseی رها)
  console.log('\n— خطایی که بعد از رمز می‌افتد، جایی که هیچ نواری نیست —');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-p-'));
  let ctx = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'], viewport: { width: 1280, height: 800 }
  });
  let p2 = ctx.pages()[0] || await ctx.newPage();
  await p2.goto(APP);
  await p2.waitForSelector('.start-screen, .worklist', { timeout: 20000 });
  if (await p2.$('.start-demo')) {
    await p2.evaluate(() => document.querySelector('.start-demo').click());
  }
  await p2.waitForTimeout(2500);
  await p2.evaluate(async () => { await window.Store.setPassword('1234'); });
  await p2.waitForTimeout(1200);

  // همان مرورگر، همان داده — این بار Notes.load می‌شکند
  await p2.addInitScript(new Function(breakAt('Notes', 'load')));
  await p2.goto(APP);
  await p2.waitForSelector('.lock-screen', { timeout: 20000 });
  await p2.fill('.lock-screen input', '1234');
  await p2.click('.lock-screen .btn.primary');
  await p2.waitForTimeout(5000);
  const afterLock = await p2.evaluate(() => ({
    white: document.body.innerText.trim().length < 20,
    fatal: !!document.querySelector('.fatal'),
    detail: (document.querySelector('.fatal-detail') || {}).textContent || '',
    lock: !!document.querySelector('.lock-screen')
  }));
  check('قفل که باز شد و کار شکست، باز هم پیام می‌آید نه سفیدی',
    !afterLock.white && afterLock.fatal && !afterLock.lock,
    JSON.stringify({ white: afterLock.white, fatal: afterLock.fatal }));
  check('و می‌گوید کجا شکسته است',
    /unlock/.test(afterLock.detail) && /Notes\.load/.test(afterLock.detail),
    afterLock.detail.slice(0, 70));
  await ctx.close();

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
