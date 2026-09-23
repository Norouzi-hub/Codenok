/*
 * سابقهٔ کار از تاریخ استخدام، و قلمِ فرم‌ها.
 *
 * دو چیز کوچک که هر دو سرِ یک جا می‌روند — کاغذی که از این برنامه بیرون
 * می‌آید:
 *
 *   ۱) «سابقهٔ کار در شهرداری» تا امروز عددی بود که موقع ساختن هر فرم
 *      دستی نوشته می‌شد و سالِ بعد هم همان می‌ماند. حالا تاریخ استخدام
 *      ثبت می‌شود و سابقه از خودِ تقویم شمسی شمرده می‌شود.
 *   ۲) فرم‌ها با قلم «B Zar» و راست‌به‌چپ ساخته می‌شوند — همان قلمی که
 *      نامه‌های دبیرخانه با آن تایپ می‌شود.
 *
 * اجرا:  node tools/test/service.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const bootApp = require('./boot');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/** یک فایل از داخل zip — همان کار unzip، در چند خط */
function unzip(file, want) {
  const buf = fs.readFileSync(file);
  let p = 0;
  while (p < buf.length - 4) {
    if (buf.readUInt32LE(p) !== 0x04034b50) break;
    const method = buf.readUInt16LE(p + 8);
    const sizeC = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.slice(p + 30, p + 30 + nameLen).toString('utf8');
    const start = p + 30 + nameLen + extraLen;
    const data = buf.slice(start, start + sizeC);
    if (name === want) {
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    p = start + sizeC;
  }
  return '';
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR', acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await bootApp(page, APP);

  // ====================================================== حساب سابقه
  console.log('\n— سابقه از تقویم شمسی شمرده می‌شود، نه با تقسیم بر ۳۶۵ —');

  const math = await page.evaluate(() => {
    const J = window.J;
    const s = (a, b) => J.span(a, b);
    return {
      exact: s('13800101', '14050101'),
      dayBorrow: s('13800115', '14050110'),
      monthBorrow: s('13801201', '14050101'),
      short: s('14050601', '14050615'),
      future: s('14060101', '14050101'),
      texts: {
        years: J.spanText('13800101', '14050101'),
        both: J.spanText('13801201', '14050101'),
        days: J.spanText('14050601', '14050615'),
        future: J.spanText('14060101', '14050101')
      }
    };
  });
  check('سال کامل، درست شمرده می‌شود',
    math.exact.y === 25 && math.exact.m === 0 && math.exact.d === 0,
    JSON.stringify(math.exact));
  check('وقتی روز کم می‌آید، از ماهِ پیش قرض گرفته می‌شود',
    math.dayBorrow.y === 24 && math.dayBorrow.m === 11,
    JSON.stringify(math.dayBorrow));
  check('وقتی ماه کم می‌آید، از سال قرض گرفته می‌شود',
    math.monthBorrow.y === 24 && math.monthBorrow.m === 1,
    JSON.stringify(math.monthBorrow));
  check('زیر یک ماه، روز گفته می‌شود',
    math.short.y === 0 && math.short.m === 0 && math.short.d === 14 &&
    math.texts.days === '۱۴ روز', math.texts.days);
  check('تاریخ استخدامِ آینده، سابقه نمی‌سازد',
    math.future === null && math.texts.future === '');
  check('متنِ سابقه همان چیزی است که در نامه می‌نویسند',
    math.texts.years === '۲۵ سال' && math.texts.both === '۲۴ سال و ۱ ماه',
    math.texts.years + ' / ' + math.texts.both);

  // ============================================== چیپِ کنار خودِ فیلد
  console.log('\n— سابقه، چسبیده به تاریخ استخدام —');

  const id = await page.evaluate(async () => {
    const r = await window.Model.create({
      caseNo: '1405950', status: 'مفتوح رسیدگی',
      firstName: 'زهرا', lastName: 'موسوی', nationalId: '0061234567',
      contractType: 'رسمی', phone: '09121234567',
      intakeDate: '14050101', deliveryDate: '14050103'
    });
    return (r.record || r).id;
  });

  const chip = await page.evaluate(async (recId) => {
    window.App.state.formTab = 'case';
    window.App.openCase(recId);
    await new Promise(r => setTimeout(r, 800));
    const field = document.querySelector('[data-field="hireDate"]');
    if (!field) return { missing: true };
    const before = field.querySelector('.svc-inline').textContent;
    const input = field.querySelector('input');
    input.value = '۱۳۸۵/۰۷/۰۱';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    return {
      group: field.closest('.form-panel')
        ? [...document.querySelectorAll('.form-section-head h4')]
          .map(h => h.textContent).join('/')
        : '',
      before: before,
      after: field.querySelector('.svc-inline').textContent,
      expected: window.J.spanText('13850701')
    };
  }, id);
  check('«تاریخ استخدام» در بخش اطلاعات شغلی است',
    !chip.missing && /اطلاعات شغلی/.test(chip.group || ''), chip.group);
  check('تا تاریخی نباشد، خودش می‌گوید چه باید کرد',
    /سابقه خودش حساب شود/.test(chip.before || ''), chip.before);
  check('تاریخ که وارد شد، سابقه همان‌جا و بدون ذخیره نوشته می‌شود',
    chip.after.indexOf(chip.expected) > 0 && /سابقهٔ کار/.test(chip.after),
    chip.after);

  const saved = await page.evaluate(async (recId) => {
    document.querySelector('.case-save').click();
    await new Promise(r => setTimeout(r, 900));
    return window.Model.get(recId).hireDate;
  }, id);
  check('و مثل هر فیلد دیگری ذخیره می‌شود', saved === '13850701', saved);

  // ==================================================== فرم‌های اداری
  console.log('\n— فرم‌ها خودشان سابقه را می‌دانند —');

  const forms = await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    const out = {};
    const read = () => [...document.querySelectorAll('.letters-form .field')]
      .reduce((a, f) => {
        a[f.querySelector('.field-label').textContent] =
          (f.querySelector('input, textarea') || {}).value;
        return a;
      }, {});
    window.UILetters.formDialog(window.App, rec,
      window.UILetters.FORMS.find(f => f.key === 'summary'));
    await new Promise(r => setTimeout(r, 400));
    out.summary = read();
    document.querySelector('.modal-head .icon-btn').click();
    await new Promise(r => setTimeout(r, 250));
    window.UILetters.formDialog(window.App, rec,
      window.UILetters.FORMS.find(f => f.key === 'defense'));
    await new Promise(r => setTimeout(r, 400));
    out.defense = read();
    document.querySelector('.modal-head .icon-btn').click();
    await new Promise(r => setTimeout(r, 250));
    out.expected = window.J.spanText(rec.hireDate);
    out.remembered = (window.Model.state.settings.letterExtras || {}).service || '';
    return out;
  }, id);
  check('فرم خلاصه، سابقه را از تاریخ استخدام پر می‌کند',
    forms.summary['سابقهٔ کار در شهرداری'] === forms.expected,
    forms.summary['سابقهٔ کار در شهرداری']);
  check('فرم تفهیم اتهام هم «از تاریخ / تا تاریخ» را خودش می‌گذارد',
    forms.defense['سابقه از تاریخ'] === '۱۳۸۵/۰۷/۰۱' &&
    /^۱۴/.test(forms.defense['سابقه تا تاریخ'] || ''),
    forms.defense['سابقه از تاریخ'] + ' تا ' + forms.defense['سابقه تا تاریخ']);
  check('سابقهٔ یک نفر، روی پروندهٔ نفر بعدی نمی‌نشیند',
    forms.remembered === '', forms.remembered || '(چیزی به یاد نمانده)');

  const other = await page.evaluate(async () => {
    /* پرونده‌ای بدون تاریخ استخدام: همان رفتار قدیمی — دستی، و
       به‌یادماندنی برای دفعهٔ بعد. */
    const r = await window.Model.create({
      caseNo: '1405951', status: 'مفتوح رسیدگی', intakeDate: '14050101'
    });
    const rec = r.record || r;
    window.UILetters.formDialog(window.App, rec,
      window.UILetters.FORMS.find(f => f.key === 'summary'));
    await new Promise(x => setTimeout(x, 400));
    const v = document.querySelector('.letters-form input').value;
    document.querySelector('.modal-head .icon-btn').click();
    return v;
  });
  check('پروندهٔ بدون تاریخ استخدام، سابقهٔ جعلی نمی‌گیرد', other === '', other);

  // ======================================================= قلم فرم‌ها
  console.log('\n— قلم «B Zar»، روی کاغذ و در فایل ورد —');

  const printCss = await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    window.UILetters.formDialog(window.App, rec,
      window.UILetters.FORMS.find(f => f.key === 'summary'));
    await new Promise(r => setTimeout(r, 300));
    [...document.querySelectorAll('.modal-foot .btn')]
      .find(b => /چاپ/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const a = document.getElementById('print-area');
    return { has: !!a.querySelector('.lf'), text: a.textContent.slice(0, 40) };
  }, id);
  check('فرم روی کاغذ ساخته می‌شود', printCss.has, printCss.text);

  await page.emulateMedia({ media: 'print' });
  const paper = await page.evaluate(() => {
    const s = getComputedStyle(document.getElementById('print-area'));
    return { font: s.fontFamily, dir: s.direction, align: s.textAlign };
  });
  await page.emulateMedia({ media: 'screen' });
  check('کاغذ با «B Zar» چاپ می‌شود و پشتش قلم‌های جایگزین هست',
    /^"?B Zar"?,/.test(paper.font) && /Vazirmatn/.test(paper.font), paper.font);
  check('و جهتش صریحاً راست‌به‌چپ است',
    paper.dir === 'rtl' && paper.align === 'right',
    paper.dir + ' / ' + paper.align);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-'));
  const file = path.join(dir, 'summary.docx');
  const dl = page.waitForEvent('download');
  await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    window.UILetters.formDialog(window.App, rec,
      window.UILetters.FORMS.find(f => f.key === 'summary'));
    await new Promise(r => setTimeout(r, 300));
    [...document.querySelectorAll('.modal-foot .btn')]
      .find(b => /خروجی ورد/.test(b.textContent)).click();
  }, id);
  await (await dl).saveAs(file);

  const doc = unzip(file, 'word/document.xml');
  const styles = unzip(file, 'word/styles.xml');
  const fonts = [...new Set((doc.match(/w:cs="([^"]+)"/g) || []))];
  const sizes = [...new Set((doc.match(/<w:sz w:val="(\d+)"\/><w:szCs w:val="(\d+)"\/>/g) || []))];
  check('همهٔ متنِ فایل ورد با «B Zar» است',
    fonts.length === 1 && fonts[0] === 'w:cs="B Zar"', fonts.join(' / '));
  check('قلم پیش‌فرضِ سند هم همان است',
    /w:ascii="B Zar" w:hAnsi="B Zar" w:cs="B Zar"/.test(styles));
  check('اندازهٔ متنِ فارسی جبران شده (B Zar ریزتر می‌نشیند)',
    /<w:sz w:val="22"\/><w:szCs w:val="26"\/>/.test(doc), sizes.join(' | '));
  check('راست‌به‌چپ در هر سه جا هست: پاراگراف، متن و جدول',
    doc.indexOf('<w:bidi/>') > 0 && doc.indexOf('<w:rtl/>') > 0 &&
    doc.indexOf('<w:bidiVisual/>') > 0);
  check('سابقهٔ حساب‌شده در خودِ فایل ورد نشسته است',
    doc.indexOf(forms.expected) > 0, forms.expected);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
