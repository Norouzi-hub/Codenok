/*
 * غلط‌یاب فارسی.
 *
 *   ۱) موتور: غلطِ تایپی، حرفِ عربی، واژهٔ تکراری، نیم‌فاصله و فاصلهٔ
 *      جاافتاده، و شکلِ نادرستِ اداری — با پیشنهادِ درست.
 *   ۲) متنِ درست غلط شمرده نمی‌شود: متنِ هر چهار مینوت، با همهٔ گیرنده‌ها.
 *   ۳) نام‌های ثبت‌شده در پرونده‌ها و واژه‌نامهٔ کاربر غلط نیستند.
 *   ۴) «اصلاح نگارشی» و بازگرداندنش؛ جای خالیِ مینوت دست نمی‌خورد.
 *   ۵) در پنجرهٔ مینوت: نوارِ غلط‌یاب، جایگزینی با یک کلیک، و پرسش پیش از کپی.
 *
 * همهٔ داده‌ها ساختگی‌اند.
 * اجرا:  node tools/test/spell.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/nokman/index.html');
const bootApp = require('./boot');

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
  const page = await (await browser.newContext({ locale: 'fa-IR', viewport: { width: 1360, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  // ================================================================ موتور
  console.log('— موتورِ غلط‌یاب —');
  const eng = await page.evaluate(() => {
    const S = window.Spell;
    const t0 = performance.now();
    const text = 'احتراما، با عنایت به نامهٔ شمارهٔ ۱۲۳ در خصوص كارمند مذکور، رییس اداره خواهشمنداست ' +
      'دستور فرمایید پرونده انظباطی ایشان را را بررسی و نتیجه اعلام شود. نامه ارسال میشود و نامهها پیوست است.';
    const issues = S.check(text);
    const ms = performance.now() - t0;
    const by = w => issues.find(i => i.word === w);
    return {
      ms, n: issues.length,
      list: issues.map(i => i.kind + ':' + i.word + '→' + i.suggestions[0]),
      typo: by('انظباطی'), arabic: by('كارمند'), dup: by('را را'), zwnj: by('میشود'),
      space: by('خواهشمنداست'), style: by('رییس'), tanvin: by('احتراما'), suffix: by('نامهها')
    };
  });
  const top = i => i && i.suggestions[0];
  check('غلطِ تایپی با پیشنهادِ درست: انظباطی ← انضباطی', top(eng.typo) === 'انضباطی', eng.list.join(' | '));
  check('حرفِ عربی: كارمند ← کارمند', eng.arabic && eng.arabic.kind === 'arabic' && top(eng.arabic) === 'کارمند');
  check('واژهٔ تکراری: «را را»', !!eng.dup);
  check('نیم‌فاصلهٔ جاافتاده: میشود ← می‌شود، نامهها ← نامه‌ها',
    top(eng.zwnj) === 'می‌شود' && top(eng.suffix) === 'نامه‌ها');
  check('فاصلهٔ جاافتاده: خواهشمنداست ← خواهشمند است', top(eng.space) === 'خواهشمند است');
  check('شکلِ اداری (زرد، نه قرمز): رییس ← رئیس، احتراما ← احتراماً',
    eng.style && eng.style.kind === 'style' && top(eng.style) === 'رئیس' && top(eng.tanvin) === 'احتراماً');
  check('همین‌ها و نه بیشتر', eng.n === 8, String(eng.n));
  check('سریع: کمتر از نیم ثانیه، با بارگذاریِ واژه‌نامه', eng.ms < 500, Math.round(eng.ms) + 'ms');

  const clean = await page.evaluate(() => {
    const S = window.Spell;
    const ok = 'احتراماً، با عنایت به نامهٔ شمارهٔ ۱۴۰۵/۱۲۳ مورخ ۱۴۰۵/۰۷/۲۰ و پیرو مکاتبات قبلی، خواهشمند است ' +
      'دستور فرمایید کارمند مذکور جهت ادای توضیحات در جلسهٔ کمیتهٔ رسیدگی به تخلفات اداری حضور یابد. ' +
      'ضمناً مستندات و دفاعیات ایشان به پیوست ارسال می‌گردد. بدین‌وسیله از همکاری شما سپاسگزاری می‌شود.';
    return S.check(ok).map(i => i.kind + ':' + i.word);
  });
  check('متنِ درستِ اداری بی‌غلط است', clean.length === 0, clean.join(' | '));

  // متنِ همهٔ مینوت‌ها، برای چند پرونده و همهٔ گیرنده‌ها: هیچ غلطی جز دادهٔ خودِ پرونده
  const mins = await page.evaluate(() => {
    const MN = window.Minute, M = window.Model, out = {};
    M.state.cases.slice(0, 10).forEach(rec => {
      MN.TYPES.forEach(t => {
        const opts = t.defaults(rec, MN.conf());
        MN.conf().recipients.forEach(rc => {
          const res = MN.build(t.key, [rec], { recipient: rc, ref: { source: 'case', relation: 'auto' }, opts });
          window.Spell.check(res.text + '\n' + res.subject + '\n' + res.relationText).forEach(i => {
            out[i.kind + ':' + i.word] = 1;
          });
        });
      });
    });
    // دادهٔ نمونه از اکسل «ي» عربی دارد — این را غلط‌یاب درست می‌گیرد
    return Object.keys(out).filter(k => k.indexOf('arabic:') !== 0);
  });
  check('متنِ هر چهار نوع مینوت، با همهٔ گیرنده‌ها، غلطی ندارد', mins.length === 0, mins.join(' | '));

  // نام‌ها و واژه‌نامهٔ کاربر
  const names = await page.evaluate(async () => {
    const S = window.Spell, M = window.Model;
    const r = await M.create({ caseNo: '1405661', status: 'مفتوح رسیدگی', firstName: 'زرنوش',
      lastName: 'کاوه‌پرور', orgUnit: 'منطقه ۲۷' });
    S.invalidate();
    const a = S.check('آقای زرنوش کاوه‌پرور از منطقه').length;
    const b0 = S.check('واژهٔ فرخنده‌وار ثبت شد').length;
    await S.addWord('فرخنده‌وار');
    const b1 = S.check('واژهٔ فرخنده‌وار ثبت شد').length;
    return { a, b0, b1, saved: (M.state.settings.spell || {}).words, id: r.id };
  });
  check('نامِ ثبت‌شده در پرونده غلط نیست', names.a === 0);
  check('«افزودن به واژه‌نامه»: دیگر غلط شمرده نمی‌شود و ذخیره می‌ماند',
    names.b0 === 1 && names.b1 === 0 && (names.saved || []).indexOf('فرخنده‌وار') >= 0);

  // اصلاح نگارشی
  const cu = await page.evaluate(() => {
    const r = window.Spell.cleanup('احتراما ، آقای ...... در جلسه ی كميته حاضر ميشود و نامهها نمیباشد .');
    return r;
  });
  check('اصلاح نگارشی: تنوین، «ی/ک»، کسرهٔ اضافه، نیم‌فاصله و فاصلهٔ نشانه‌ها',
    cu.text === 'احتراماً، آقای ...... در جلسهٔ کمیته حاضر می‌شود و نامه‌ها نمی‌باشد.' && cu.changes > 0,
    cu.text);
  check('جای خالیِ مینوت («......») دست نمی‌خورد', cu.text.indexOf('......') > 0);

  // ======================================================= پنجرهٔ مینوت
  console.log('\n— در پنجرهٔ مینوت —');
  const ui = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => !/مختومه/.test(c.status));
    window.UIMinute.open(window.App, [rec], { type: 'invite' });
    await new Promise(r => setTimeout(r, 500));
    const ta = document.querySelector('.mn-body');
    const st0 = document.querySelector('.mn-body-wrap .sp-status').textContent;
    // کاربر غلط تایپ می‌کند
    ta.focus();
    ta.setRangeText(' پرونده انظباطی ', 0, 0, 'end');
    ta.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    ta._spell.refresh();
    const st1 = document.querySelector('.mn-body-wrap .sp-status').textContent;
    document.querySelector('.mn-body-wrap .sp-status').click();
    await new Promise(r => setTimeout(r, 50));
    const rows = document.querySelectorAll('.mn-body-wrap .sp-row').length;
    const sug = document.querySelector('.mn-body-wrap .sp-sug');
    const sugText = sug && sug.textContent;
    sug.click();
    await new Promise(r => setTimeout(r, 50));
    const fixed = ta.value.indexOf('انضباطی') >= 0 && ta.value.indexOf('انظباطی') < 0;
    const st2 = document.querySelector('.mn-body-wrap .sp-status').textContent;
    const edited = window.document.querySelector('.mn-rebuild').style.display !== 'none';
    // اصلاح نگارشی و بازگرداندن
    const before = ta.value;
    ta.value = before + '\nنامه ها ارسال ميشود';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.mn-body-wrap .sp-clean').click();
    await new Promise(r => setTimeout(r, 50));
    const cleaned = /نامه‌ها ارسال می‌شود$/.test(ta.value);
    const blank = ta.value.indexOf('......') >= 0 === before.indexOf('......') >= 0;
    document.querySelector('.mn-body-wrap .sp-undo').click();
    const undone = /نامه ها ارسال ميشود$/.test(ta.value);
    return { st0, st1, rows, sugText, fixed, st2, edited, cleaned, blank, undone };
  });
  check('متنِ ساخته‌شده: «✓ غلط تایپی پیدا نشد»', /پیدا نشد/.test(ui.st0), ui.st0);
  check('غلطِ تایپ‌شده شمرده می‌شود و فهرستش باز می‌شود', /۱ غلط احتمالی/.test(ui.st1) && ui.rows === 1, ui.st1);
  check('یک کلیک روی پیشنهاد، جایگزین می‌کند', ui.sugText === 'انضباطی' && ui.fixed && /پیدا نشد/.test(ui.st2));
  check('جایگزینی مثلِ تایپِ کاربر است (متن «دستی تغییر کرده»)', ui.edited);
  check('«اصلاح نگارشی» در متن، و «بازگرداندن»', ui.cleaned && ui.blank && ui.undone);

  // پیش از کپی، اگر غلطی مانده
  const guard = await page.evaluate(async () => {
    const ta = document.querySelector('.mn-body');
    ta.value = ta.value + '\nتخلفاط';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__copied = [];
    navigator.clipboard.writeText = t => { window.__copied.push(t); return Promise.resolve(); };
    const btn = [...document.querySelectorAll('.minute-modal .modal-foot .btn')].find(b => /اتوماسیون/.test(b.textContent));
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const box = [...document.querySelectorAll('.modal')].pop();
    const asked = box && /غلط تایپی/.test(box.textContent) && /تخلفاط/.test(box.textContent);
    // «نه»: کپی نمی‌شود و فهرست باز است
    const no = [...box.querySelectorAll('.btn')].find(b => !/ادامه/.test(b.textContent));
    no.click();
    await new Promise(r => setTimeout(r, 300));
    const copiedAfterNo = window.__copied.length;
    const panelOpen = document.querySelector('.mn-body-wrap .sp-panel').style.display !== 'none';
    // «بله، ادامه»
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const box2 = [...document.querySelectorAll('.modal')].pop();
    [...box2.querySelectorAll('.btn')].find(b => /ادامه/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    return { asked, copiedAfterNo, panelOpen, copied: window.__copied.length };
  });
  check('پیش از کپی می‌پرسد اگر غلطی مانده (با نامِ واژه)', guard.asked);
  check('«نه»: کپی نمی‌شود و فهرستِ غلط‌ها باز می‌شود', guard.copiedAfterNo === 0 && guard.panelOpen);
  check('«بله، ادامه»: کپی می‌شود', guard.copied === 1);

  // فیلدِ متنیِ پرونده
  const form = await page.evaluate(async () => {
    document.querySelectorAll('.modal .btn').forEach(b => { if (/بستن/.test(b.textContent)) b.click(); });
    const rec = window.Model.state.cases[0];
    window.App.state.formTab = 'case';
    window.App.openCase(rec.id);
    await new Promise(r => setTimeout(r, 600));
    const n = document.querySelectorAll('.case-view .sp-field .sp-box').length;
    return { n, tas: document.querySelectorAll('.case-view textarea').length };
  });
  check('زیرِ فیلدهای متنیِ پرونده هم غلط‌یاب هست', form.n > 0 && form.n === form.tas, form.n + '/' + form.tas);

  // خاموش کردن
  const off = await page.evaluate(async () => {
    await window.Spell.setOption({ off: true });
    const rec = window.Model.state.cases[0];
    window.UIMinute.open(window.App, [rec], { type: 'invite' });
    await new Promise(r => setTimeout(r, 400));
    const has = !!document.querySelector('.minute-modal .sp-box');
    await window.Spell.setOption({ off: false });
    return has;
  });
  check('در تنظیمات خاموش می‌شود', off === false);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
