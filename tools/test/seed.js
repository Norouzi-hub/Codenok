/*
 * نسخهٔ شخصی: دفتر مقامات همراهِ برنامه.
 *
 *   tools/build.py --officials list.json --out <پوشه‌ای بیرون از مخزن>
 *
 *   ۱) ساختن در خودِ مخزن رد می‌شود (نام‌های واقعی نباید در git بنشینند).
 *   ۲) در پوشه و تک‌فایلی، دفترِ خالی خودبه‌خود پر می‌شود و مینوت نام را دارد.
 *   ۳) دفتری که کاربر خودش دارد دست نمی‌خورد؛ دفتری که خالی کرده، دوباره پر نمی‌شود.
 *
 * همهٔ نام‌ها ساختگی‌اند.
 * اجرا:  node tools/test/seed.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');
const bootApp = require('./boot');

const ROOT = path.resolve(__dirname, '../..');
let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
  const list = path.join(tmp, 'list.json');
  fs.writeFileSync(list, JSON.stringify({ source: 'فهرست ساختگی.xlsx', list: [
    { honor: 'جناب آقای', name: 'پیمان نمونه‌ای', title: 'شهردار محترم منطقه ۵', org: 'منطقه ۵', rank: 'high' },
    { honor: 'سرکار خانم', name: 'ژاله فرضی', title: 'مدیرعامل محترم شرکت خدمات اداری شهر', org: 'شرکت خدمات اداری شهر', rank: 'low' }
  ] }));

  console.log('— ساختِ نسخهٔ شخصی —');
  let refused = false;
  try {
    execFileSync('python3', [path.join(ROOT, 'tools/build.py'), '--officials', list], { stdio: 'pipe' });
  } catch (e) { refused = /بیرون از مخزن/.test(String(e.stderr)); }
  check('ساختن در خودِ مخزن رد می‌شود', refused);
  const out = path.join(tmp, 'out');
  const log = execFileSync('python3', [path.join(ROOT, 'tools/build.py'), '--officials', list, '--out', out]).toString();
  check('بیرون از مخزن ساخته می‌شود', /۲ نفر|2 نفر/.test(log) && fs.existsSync(path.join(out, 'nokman.zip')) &&
    fs.existsSync(path.join(out, 'nokman/assets/data/officials-seed.js')));
  const tracked = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src', 'dist']).toString();
  check('مخزن نام‌ها را ندارد', !/پیمان نمونه‌ای/.test(fs.readFileSync(path.join(ROOT, 'dist/nokman.html'), 'utf8')) &&
    !fs.existsSync(path.join(ROOT, 'src/assets/data/officials-seed.js')), tracked.split('\n').length + ' تغییر');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  for (const file of ['nokman/index.html', 'nokman.html']) {
    console.log('\n— ' + file + ' —');
    const page = await (await browser.newContext({ locale: 'fa-IR' })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await bootApp(page, 'file://' + path.join(out, file));
    await page.waitForFunction(() => window.Officials && window.Officials.list().length > 0, null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(async () => {
      const O = window.Officials, MN = window.Minute;
      const rec = { servicePlace: 'شهرداری منطقه پنج', firstName: 'ا', lastName: 'ب' };
      const R = id => MN.conf().recipients.find(x => x.id === id);
      return { n: O.list().length, src: O.data().source,
        mayor: MN.build('invite', [rec], { recipient: R('mayor') }).to,
        khad: MN.build('invite', [rec], { recipient: R('khadamat') }).to };
    });
    check('دفترِ خالی خودبه‌خود پر شد', r.n === 2 && r.src === 'فهرست ساختگی.xlsx', JSON.stringify({ n: r.n, src: r.src }));
    check('مینوت نام را دارد', r.mayor === 'جناب آقای پیمان نمونه‌ای شهردار محترم منطقه ۵' && /^سرکار خانم ژاله فرضی/.test(r.khad),
      r.mayor);
    // دفترِ خودِ کاربر حرفِ آخر است
    await page.evaluate(async () => {
      const O = window.Officials;
      await O.setList([Object.assign({}, O.list()[0], { name: 'رامین دستی' })]);
    });
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const kept = await page.evaluate(() => window.Officials.list().map(o => o.name).join());
    check('دفتری که کاربر عوض کرده، با فهرستِ همراه رونویسی نمی‌شود', kept === 'رامین دستی', kept);
    await page.evaluate(async () => { await window.Officials.setList([]); });
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const empty = await page.evaluate(() => window.Officials.list().length);
    check('دفتری که کاربر خالی کرده، دوباره پر نمی‌شود', empty === 0, String(empty));
    check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
