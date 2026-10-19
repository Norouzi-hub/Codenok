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
// نام سازنده از خودِ brand.js
function window_owner() {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/assets/js/brand.js'), 'utf8');
  return (src.match(/owner:\s*'([^']*)'/) || [])[1];
}
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

  // ===================================================== پانویس
  console.log('\n— پانویس و «دربارهٔ نوکمان» —');
  const foot = await page.evaluate(async () => {
    const f = document.querySelector('.app-footer');
    if (!f) return null;
    const B = window.BRAND;
    const tel = f.querySelector('a.ft-phone'), site = f.querySelector('a.ft-site');
    const r = f.getBoundingClientRect();
    const out = {
      text: f.textContent, owner: B.owner,
      tel: tel && tel.getAttribute('href'), site: site && site.getAttribute('href'),
      blank: site && site.target === '_blank' && /noopener/.test(site.rel),
      atBottom: Math.abs(r.bottom - window.innerHeight) < 1, h: r.height
    };
    f.querySelector('.ft-seal').click();
    await new Promise(r => setTimeout(r, 600));
    const card = document.querySelector('.about-card');
    out.about = card && card.textContent;
    out.ring = card && card.querySelector('.sl-ring').getComputedTextLength();
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    return out;
  });
  check('پانویس هست، باریک، و ته صفحه', foot && foot.atBottom && foot.h <= 44,
    foot && (foot.h + 'px'));
  check('کپی‌رایت، نام برنامه و نام سازنده', foot && /©/.test(foot.text) &&
    /نوکمان/.test(foot.text) && foot.text.indexOf(foot.owner) >= 0 &&
    /حقوق محفوظ/.test(foot.text));
  check('شمارهٔ موبایل پیوندِ tel: است، با ارقام لاتین',
    foot && /^tel:\+?\d{7,}$/.test(foot.tel), foot && foot.tel);
  check('سایت در پنجرهٔ تازه باز می‌شود', foot && /^https?:\/\//.test(foot.site) && foot.blank,
    foot && foot.site);
  check('مُهر «دربارهٔ نوکمان» را باز می‌کند، با نوشتهٔ دورِ مُهر',
    foot && /نوکمان/.test(foot.about || '') && foot.ring > 150, foot && Math.round(foot.ring));

  // ============================================ دروازه: صفحهٔ شروع و قفل
  console.log('\n— صفحه‌های ورود —');
  const os = require('os');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nk-gate-'));
  const pc = await chromium.launchPersistentContext(prof, {
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'], viewport: { width: 1360, height: 860 }
  });
  const gp = pc.pages()[0] || await pc.newPage();
  await gp.goto(APP);
  await gp.waitForSelector('.start-screen');
  const startG = await gp.evaluate(() => {
    const s = document.querySelector('.start-screen');
    return {
      gate: s.classList.contains('gate'),
      owner: (s.querySelector('.gate-footer .ft-owner') || {}).textContent,
      tel: (s.querySelector('.gate-footer a.ft-phone') || {}).href,
      ring: s.querySelector('.gate-seal .sl-ring') ? s.querySelector('.gate-seal .sl-ring').getComputedTextLength() : 0,
      title: (s.querySelector('.gate-title') || {}).textContent,
      opts: s.querySelectorAll('.start-opt').length, demo: !!s.querySelector('.start-demo')
    };
  });
  check('صفحهٔ شروع در دروازه: مُهر، نام و پانویسِ سازنده', startG.gate && startG.title === 'نوکمان' &&
    startG.ring > 150 && startG.owner === window_owner() && /^tel:/.test(startG.tel || ''),
    JSON.stringify(startG));
  check('گزینه‌های دیتابیس سرِ جایشان‌اند', startG.opts >= 1 && startG.demo);
  await gp.evaluate(() => document.querySelector('.start-demo').click());
  await gp.waitForTimeout(2500);
  await gp.evaluate(async () => { await window.Store.setPassword('1234'); });
  await gp.waitForTimeout(600);
  await gp.reload();
  await gp.waitForSelector('.lock-screen');
  const lockG = await gp.evaluate(async () => {
    const s = document.querySelector('.lock-screen');
    const input = s.querySelector('.lock-input');
    s.querySelector('.lock-eye').click();
    const shown = input.type;
    s.querySelector('.lock-eye').click();
    return { gate: s.classList.contains('gate'), shown, hidden: input.type,
      footer: !!s.querySelector('.gate-footer'), h: (s.querySelector('.lock-h') || {}).textContent };
  });
  check('صفحهٔ قفل در دروازه، با پانویس', lockG.gate && lockG.footer && lockG.h === 'خوش آمدید');
  check('چشمِ رمز: نمایش و پنهان', lockG.shown === 'text' && lockG.hidden === 'password');
  await gp.fill('.lock-input', '9999');
  await gp.keyboard.press('Enter');
  await gp.waitForSelector('.lock-msg.bad', { timeout: 20000 });
  const shook = await gp.evaluate(() => document.querySelector('.lock-box').classList.contains('is-shake'));
  check('رمزِ نادرست: کارت می‌لرزد', shook);
  await gp.fill('.lock-input', '1234');
  await gp.keyboard.press('Enter');
  await gp.waitForFunction(() => !document.querySelector('.lock-screen'), null, { timeout: 20000 });
  check('رمزِ درست: دروازه باز می‌شود', true);
  await pc.close();

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
