/*
 * نامهٔ سربرگ‌دار، مثلِ نمونهٔ خودِ دبیرخانه — در ورد و در چاپ.
 *
 *   ۱) همه‌چیز راست‌به‌چپ: در ورد «right/left» برای پاراگرافِ راست‌به‌چپ
 *      جابه‌جا خوانده می‌شود؛ پس فقط start/end/center/both.
 *   ۲) «ٔ» نیست — در B Zar نیست و ورد جایش دایرهٔ خالی می‌گذارد.
 *   ۳) قلمِ همهٔ متن B Zar (هر چهار جایگاه)، بی Times New Roman.
 *   ۴) تاریخ و شمارهٔ نامه وارونه نمی‌شوند.
 *   ۵) سربرگ: نوارِ ۵۸ میلی‌متریِ راست، شماره بالای نوار، امضا چپ،
 *      «تهیه‌کننده» کنارِ امضا در نوار؛ همه در یک صفحه.
 *   ۶) مخاطب: «جناب آقای» دو بار نمی‌آید؛ از دفتر مقامات پر می‌شود.
 *
 * همهٔ نام‌ها ساختگی‌اند.
 * اجرا:  node tools/test/wordlayout.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');
const bootApp = require('./boot');

const APP = 'file://' + path.resolve(__dirname, '../../dist/nokman/index.html');
let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}
function unzip(file, entry) {
  return execFileSync('python3', ['-I', '-c',
    'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8"))',
    file, entry]).toString('utf8');
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-'));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const page = await (await browser.newContext({ locale: 'fa-IR', acceptDownloads: true })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  const r = await page.evaluate(async () => {
    const M = window.Model, L = window.UILetters;
    await M.saveSettings({ letters: { signerName: 'امیر نمونه', signerRole: 'مدیرکل', preparedBy: 'کاربر آزمایشی' } });
    const rec = await M.create({ caseNo: '1404512', status: 'رأی صادر شد', firstName: 'محمد', lastName: 'آزمون',
      nationalId: '0012345678', contractType: 'شرکت خدمات اداری شهر', orgUnit: 'منطقهٔ ۱۴',
      servicePlace: 'شهرداری منطقه چهارده',
      letterNo: '112/1404/134/298', letterDate: '14041120', committeeDate: '14050719', committeeRegNo: '6995',
      verdictFull: 'به توبیخ کتبی با درج در پروندهٔ نامبرده محکوم می‌گردد.' });
    window.__id = rec.id;
    const doc = L.build('notice', rec, { outLetterNo: '۱۴۰۵/۳۱۱/م', addressee: 'جناب آقای رضا نمونه',
      addresseeRole: 'شهردار محترم منطقه ۱۴' });
    const blob = L.toDocx(doc);
    const b = new Uint8Array(await blob.arrayBuffer());
    let s = ''; b.forEach(x => { s += String.fromCharCode(x); });
    const c = L.conf();
    return { b64: btoa(s), to: doc.blocks.find(x => x.t === 'to').lines[0],
      conf: { top: c.letterheadTop, right: c.letterheadRight, left: c.letterheadLeft } };
  });
  const file = path.join(tmp, 'notice.docx');
  fs.writeFileSync(file, Buffer.from(r.b64, 'base64'));
  const xml = unzip(file, 'word/document.xml');
  const styles = unzip(file, 'word/styles.xml');

  console.log('— ورد —');
  const jcs = (xml.match(/<w:jc w:val="(\w+)"/g) || []).map(x => /"(\w+)"/.exec(x)[1]);
  check('راست‌به‌چپ: هیچ ترازِ right/left (که ورد وارونه می‌خواند)',
    jcs.length > 10 && jcs.every(v => ['start', 'end', 'center', 'both'].indexOf(v) >= 0),
    [...new Set(jcs)].join(','));
  check('همهٔ پاراگراف‌ها و جدول‌ها راست‌به‌چپ', (xml.match(/<w:p>/g) || []).length ===
    (xml.match(/<w:p><w:pPr>(?:<w:keepNext\/>)?(?:<w:framePr[^>]*\/>)?<w:bidi\/>/g) || []).length +
    (xml.match(/<w:p><w:pPr><w:bidi\/>/g) || []).length * 0 && /<w:bidiVisual\/>/.test(xml));
  check('«ٔ» در فایل نیست (جایش دایرهٔ خالی می‌آمد)', xml.indexOf('ٔ') < 0 && /نامه شماره/.test(xml) &&
    /پرونده نامبرده/.test(xml));
  const fonts = xml.match(/<w:rFonts [^>]*\/>/g) || [];
  check('قلمِ همهٔ متن B Zar، در هر چهار جایگاه', fonts.length > 20 && fonts.every(f =>
    /w:ascii="B Zar"/.test(f) && /w:hAnsi="B Zar"/.test(f) && /w:eastAsia="B Zar"/.test(f) && /w:cs="B Zar"/.test(f)) &&
    /w:eastAsia="B Zar"/.test(styles) && !/Times/.test(xml + styles), fonts.length + ' اجرا');
  check('تاریخ و شمارهٔ نامه با نشانهٔ چپ‌به‌راست، تا وارونه نشوند',
    xml.indexOf('‪۱۴۰۴/۱۱/۲۰‬') > 0 && xml.indexOf('‪۱۴۰۵/۰۷/۱۹‬') > 0);
  const pg = /<w:pgMar w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"/.exec(xml).slice(1).map(v => Math.round(v / 56.6929));
  check('سربرگ از راست (۵۸) نه از بالا (۲۰)، چپ ۱۰', pg[0] === 20 && pg[1] === 58 && pg[3] === 10, pg.join(','));
  const frames = xml.match(/<w:framePr [^>]*\/>/g) || [];
  check('شمارهٔ نامه بالای نوارِ سربرگ، «تهیه‌کننده» کنارِ امضا در همان نوار', frames.length === 2 &&
    /w:vAnchor="page"/.test(frames[0]) && /w:vAnchor="text"/.test(frames[1]) &&
    Math.round(/w:x="(\d+)"/.exec(frames[0])[1] / 56.6929) === 153, frames.length + ' قاب');
  check('امضا سمتِ چپ: جدولِ بی‌خطِ دوستونه، ستونِ دوم وسط‌چین',
    /<w:tbl><w:tblPr><w:bidiVisual\/>[^]*?امیر نمونه/.test(xml) && /<w:jc w:val="center"\/><\/w:pPr><w:r>[^]*?امیر نمونه/.test(xml));
  check('مخاطب: «جناب آقای» یک بار', r.to === 'جناب آقای رضا نمونه', r.to);

  // تبدیل با LibreOffice، اگر هست: یک صفحه، و بی دایرهٔ خالی
  let lo = null;
  try { lo = execFileSync('which', ['soffice']).toString().trim(); } catch (e) { lo = null; }
  if (lo) {
    try {
      execFileSync(lo, ['--headless', '--convert-to', 'pdf', '--outdir', tmp, file], { stdio: 'ignore', timeout: 120000 });
      const pages = /Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path.join(tmp, 'notice.pdf')]).toString())[1];
      const text = execFileSync('pdftotext', [path.join(tmp, 'notice.pdf'), '-']).toString();
      check('نامهٔ ابلاغ در یک صفحه جا می‌شود', pages === '1', pages + ' صفحه');
      check('در خروجی دایرهٔ خالی (◌) نیست', text.indexOf('◌') < 0 && text.indexOf('ٔ') < 0);
    } catch (e) { console.log('  (تبدیل با LibreOffice انجام نشد: ' + e.message.split('\n')[0] + ')'); }
  }

  // ========================================================= چاپ
  console.log('\n— چاپ —');
  const pr = await page.evaluate(() => {
    window.print = () => {};
    window.UILetters.printNotice(window.Model.get(window.__id), { outLetterNo: '۱۴۰۵/۳۱۱/م',
      addressee: 'رضا نمونه', addresseeRole: 'شهردار محترم منطقه ۱۴' });
    const wrap = document.querySelector('#print-area .lf');
    const no = document.querySelector('#print-area .lf-letter-no');
    const prep = document.querySelector('#print-area .lf-prepared');
    return { right: wrap.style.paddingRight, left: wrap.style.paddingLeft, start: wrap.style.paddingInlineStart,
      noBand: no && no.classList.contains('in-band') && no.style.right === '7mm',
      prepBand: prep && prep.classList.contains('in-band') && !!prep.closest('.lf-signer-row'),
      text: document.getElementById('print-area').textContent,
      to: document.querySelector('#print-area .lf-to div').textContent };
  });
  check('نوارِ سربرگ سمتِ راست (نه چپ): ۵۸ منهای ۱۰ حاشیهٔ کاغذ', pr.right === '48mm' && pr.left === '0mm', pr.right + ' / ' + pr.left);
  check('شماره در نوار، «تهیه‌کننده» کنارِ امضا', pr.noBand && pr.prepBand);
  check('در چاپ هم «ٔ» نیست', pr.text.indexOf('ٔ') < 0 && /نامه شماره/.test(pr.text));
  check('مخاطبِ بی‌عنوان «جناب آقای» می‌گیرد', pr.to === 'جناب آقای رضا نمونه', pr.to);

  // ========================================================= مخاطب از دفتر مقامات
  console.log('\n— مخاطب از دفتر مقامات —');
  const off = await page.evaluate(async () => {
    const O = window.Officials;
    await O.setList([{ id: 'x1', honor: 'سرکار خانم', name: 'نسیم آزمایشی', title: 'شهردار محترم منطقه ۱۴',
      org: 'منطقه ۱۴', rank: 'high' }]);
    const rec = window.Model.get(window.__id);
    const f = window.UILetters.FORMS.find(x => x.key === 'notice');
    window.UILetters.formDialog(window.App, rec, f);
    await new Promise(r => setTimeout(r, 300));
    const inputs = [...document.querySelectorAll('.letters-modal .letters-grid input, .letters-modal .letters-grid textarea')];
    return inputs.map(i => i.value).slice(0, 2);
  });
  check('ابلاغ: مخاطب، شهردارِ منطقهٔ کارمند از دفتر مقامات', off[0] === 'سرکار خانم نسیم آزمایشی' &&
    off[1] === 'شهردار محترم منطقه ۱۴', off.join(' | '));

  // تنظیمِ قدیمی (سربرگ از بالا) خودش به اندازهٔ تازه می‌رود؛ تنظیمِ دستی نه
  const mig = await page.evaluate(async () => {
    const M = window.Model, L = window.UILetters;
    await M.saveSettings({ letters: { letterheadTop: 45, letterheadRight: 25, letterheadBottom: 25 } });
    const a = L.conf();
    await M.saveSettings({ letters: { letterheadTop: 30, letterheadRight: 50 } });
    const b = L.conf();
    return { a: [a.letterheadTop, a.letterheadRight], b: [b.letterheadTop, b.letterheadRight] };
  });
  check('اندازه‌های قدیمیِ پیش‌فرض (۴۵ بالا، ۲۵ راست) به اندازهٔ نمونه می‌روند', mig.a.join() === '20,58', mig.a.join());
  check('اندازه‌ای که کاربر خودش گذاشته، می‌ماند', mig.b.join() === '30,50', mig.b.join());

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
