/*
 * نوکمان: نام، ساختار پروژه، انیمیشن‌ها و «نام پست».
 *
 *   ۱) نام برنامه همه‌جا «نوکمان» است.
 *   ۲) index.html فقط ساختار است؛ اسکریپت و استایل در assets/.
 *   ۳) انیمیشن‌ها روی رایانه‌ای که ویندوزش «کاهش حرکت» خواسته هم کار
 *      می‌کنند (پیش‌فرض)، و با تنظیم «طبق ویندوز» یا «خاموش» خاموش می‌شوند.
 *   ۴) «نام پست» از فرم پرونده رفته، ولی مقدارِ پرونده‌های قدیمی گم نمی‌شود.
 *
 * اجرا:  node tools/test/nokman.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');

const DIST = path.resolve(__dirname, '../../dist/nokman/index.html');
const APP = 'file://' + DIST;
const bootApp = require('./boot');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  // ================================================ ساختار پروژه
  console.log('— ساختار پروژه —');
  const html = fs.readFileSync(DIST, 'utf8');
  check('index.html اسکریپت یا استایلِ درون‌خطی ندارد',
    !/<script>(?!\s*<\/script>)/.test(html) && !/<style/.test(html));
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  check('همهٔ ارجاع‌ها به assets/ است و همه وجود دارند',
    refs.length > 40 && refs.every(r => r.startsWith('assets/') &&
      fs.existsSync(path.join(path.dirname(DIST), r))), refs.length + ' ارجاع');
  const dirs = ['css', 'js', 'fonts', 'vendor', 'img'].filter(d =>
    fs.existsSync(path.join(path.dirname(DIST), 'assets', d)));
  check('هر جنس در پوشهٔ خودش', dirs.length === 5, dirs.join('، '));
  check('زیپ و نسخهٔ تک‌فایلی ساخته شده‌اند',
    fs.existsSync(path.resolve(__dirname, '../../dist/nokman.zip')) &&
    fs.existsSync(path.resolve(__dirname, '../../dist/nokman.html')));

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });

  // =============================== انیمیشن، وقتی ویندوز «کاهش حرکت» خواسته
  console.log('\n— انیمیشن روی رایانه‌ای که ویندوزش «کاهش حرکت» خواسته —');
  const ctx = await browser.newContext({
    viewport: { width: 1300, height: 950 }, locale: 'fa-IR', reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  const name = await page.evaluate(() => ({
    title: document.title,
    brand: (document.querySelector('.brand-text b') || {}).textContent,
    font: [...document.fonts].some(f => /Vazirmatn/.test(f.family) && f.status === 'loaded')
  }));
  check('نام: «نوکمان»', /^نوکمان/.test(name.title) && name.brand === 'نوکمان',
    name.title + ' / ' + name.brand);
  check('قلم وزیرمتن از assets/fonts بارگذاری شد', name.font);

  const anim = await page.evaluate(async () => {
    const J = window.J, t = J.today();
    const rec = await window.Model.create({
      caseNo: '1405601', status: 'مفتوح رسیدگی', firstName: 'آزمون',
      invitationLetterDate: J.addDays(t, -20), defenseDueDate: J.addDays(t, -3)
    });
    const count = async () => {
      window.App.openCase(rec.id);
      await new Promise(r => setTimeout(r, 900));
      return document.getAnimations().filter(a => a.playState === 'running').length;
    };
    const out = { system: window.U.systemReduce(), mode: window.U.motionMode() };
    out.on = await count();
    window.U.setMotion('system'); out.sys = await count();
    window.U.setMotion('off'); out.off = await count();
    window.U.setMotion('on'); out.back = await count();
    return out;
  });
  check('ویندوزِ آزمون «کاهش حرکت» خواسته', anim.system);
  check('پیش‌فرض «روشن» است و انیمیشن‌ها با این حال کار می‌کنند',
    anim.mode === 'on' && anim.on >= 2, anim.on + ' انیمیشن');
  check('«طبق ویندوز» و «خاموش» خاموششان می‌کنند', anim.sys === 0 && anim.off === 0,
    anim.sys + ' / ' + anim.off);
  check('و برمی‌گردند', anim.back >= 2);

  const set = await page.evaluate(async () => {
    window.U.setMotion('on');
    document.querySelector('[title="تنظیمات"], .settings-btn') &&
      document.querySelector('[title="تنظیمات"], .settings-btn').click();
    await new Promise(r => setTimeout(r, 500));
    const block = document.querySelector('.motion-block');
    return block ? { text: block.textContent, value: block.querySelector('select').value } : null;
  });
  check('تنظیمات بخش «انیمیشن‌ها» دارد و می‌گوید چرا خاموش بودند',
    set && set.value === 'on' && /کاهش حرکت/.test(set.text), set && set.text.slice(0, 50));

  // ================================================== «نام پست»
  console.log('\n— «نام پست» —');
  const post = await page.evaluate(async () => {
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    window.App.newCase();
    await new Promise(r => setTimeout(r, 600));
    const fresh = !!document.querySelector('[data-field="postTitle"]');
    const old = await window.Model.create({ caseNo: '1405602', status: 'مفتوح رسیدگی',
      postTitle: 'رئیس اداره', jobTitle: 'کارشناس' });
    window.App.openCase(old.id);
    await new Promise(r => setTimeout(r, 700));
    const box = document.querySelector('[data-field="postTitle"] input');
    return { fresh, oldShown: !!box, oldValue: box && box.value,
      stillInData: window.Model.get(old.id).postTitle };
  });
  check('در پروندهٔ تازه نیست', !post.fresh);
  check('پروندهٔ قدیمی‌ای که مقدار دارد، هنوز نشانش می‌دهد',
    post.oldShown && post.oldValue === 'رئیس اداره', String(post.oldValue));
  check('داده پاک نشده', post.stillInData === 'رئیس اداره');

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
