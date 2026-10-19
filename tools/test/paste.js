/*
 * چسباندن از سامانهٔ کارگزینی.
 *
 * صفحهٔ «مشخصات» کارمند در سامانهٔ منابع انسانی کپی می‌شود و هر مقدار در
 * فیلدِ خودش می‌نشیند. داده‌های این آزمون ساختگی‌اند؛ فقط *شکلِ* متن از
 * سامانه گرفته شده: برچسب در یک سطر، مقدار در سطرِ بعد، سطرهای خالی بین
 * آن‌ها، برچسب‌های بی‌مقدار، و سربرگ‌های بخش.
 *
 * اجرا:  node tools/test/paste.js
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

// ساختگی، به همان شکلِ خروجی سامانه
const PROFILE = [
  'بهرام نیک‌پور', 'کارشناس اداری (3)', 'شرکت خدمات اداری شهر',
  '0012345679', '0012345679',
  'مشخصات', 'خلاصه مشخصات', 'مشخصات عمومی', 'مشخصات فردی', 'مشخصات بستگان',
  'آدرس', 'خلاصه مشخصات', 'مشخصات فردی',
  'کد ملی', '0012345679', '',
  'روز تولد', '1370/03/15', '',
  'جنسیت', 'مرد', '',
  'وضعیت تاهل', 'مجرد', '',
  'مدرک', 'فوق لیسانس', '',
  'شماره حساب', '111122223333', '',
  'شماره تماس', '09120001122', '',
  'شماره شناسنامه', '5521', '',
  'نام پدر', 'کامران', '',
  'وضعیت خدمت', 'معاف', '',
  'تعداد فرزندان', '0', '',
  'رشته تحصیلی', 'مدیریت دولتی null', '',
  'شماره بیمه', '99887766', '',
  'جمع روز های بیمه پردازی', '1500', '',
  'مشخصات استخدامی',
  'محل پرداخت', 'شرکت خدمات اداری شهر', '',
  'واحد سازمانی', '',
  'تاریخ استخدام', '1398/02/01', '',
  'عنوان شغلی', 'کارشناس اداری (3)', '',
  'گروه شغلی', '12', '',
  'شغل - طبقه بندی', '',
  'مرکز هزینه', 'شهرداری منطقه هشت', '',
  'محل خدمت', 'شهرداری منطقه هشت', '',
  'نوع استخدام', 'تمام وقت عادی 101', '',
  'کد شغل', '900001111', '',
  'ماهیت شغلی', 'کارمندی', '',
  'مشخصات حکمی',
  'نوع حکم', 'تجدید قرارداد', '',
  'تاریخ آغاز اعتبار حکم', '1405/07/01', '',
  'تاریخ پایان اعتبار حکم', '1405/12/29', '',
  'مشخصات ایثارگری',
  'جانباز', 'خیر', '', 'درصد جانبازی', '0', '',
  'آزاده', 'خیر', '', 'مدت آزادگی', '0', '',
  'فرزند شهید', 'خیر', '',
  'رزمنده', 'خیر', '', 'مدت رزمندگی', '0', '',
  'بسیجی', 'خیر', '', 'مدت بسیج', '0'
].join('\n');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1100 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await bootApp(page, APP);

  // ======================================================== خواندن متن
  console.log('— متنِ سامانه، فیلد به فیلد —');
  const p = await page.evaluate(t => {
    const r = window.Paste.parse(t);
    return { v: r.values, skipped: r.skipped, unknown: r.unknown.length,
      rows: r.rows.map(x => x.key), inferred: r.rows.filter(x => x.inferred).map(x => x.key) };
  }, PROFILE);
  const v = p.v;
  check('کد ملی', v.nationalId === '0012345679', v.nationalId);
  check('نام و نام خانوادگی از سرِ صفحه', v.firstName === 'بهرام' && v.lastName === 'نیک‌پور',
    v.firstName + ' / ' + v.lastName);
  check('مشخصات فردی', v.gender === 'مرد' && v.maritalStatus === 'مجرد' &&
    v.education === 'فوق لیسانس' && v.phone === '09120001122' &&
    v.idNumber === '5521' && v.fatherName === 'کامران', JSON.stringify([v.gender, v.maritalStatus, v.education]));
  check('تاریخ تولد و رشته (بی «null»)', v.birthDate === '13700315' &&
    v.fieldOfStudy === 'مدیریت دولتی', v.birthDate + ' / ' + v.fieldOfStudy);
  check('اطلاعات شغلی', v.payrollPlace === 'شرکت خدمات اداری شهر' &&
    v.hireDate === '13980201' && v.jobTitle === 'کارشناس اداری (3)' &&
    v.jobGrade === '12' && v.servicePlace === 'شهرداری منطقه هشت' &&
    v.jobNature === 'کارمندی' && v.employType === 'تمام وقت عادی 101',
    JSON.stringify([v.hireDate, v.jobTitle, v.jobGrade, v.employType]));
  check('برچسبِ بی‌مقدار، مقدارِ برچسبِ بعدی را نمی‌دزدد',
    v.orgUnit === undefined && v.hireDate === '13980201', String(v.orgUnit));
  check('نوع قرارداد از نام شرکت، نوع محل خدمت از «منطقه»',
    v.contractType === 'شرکت خدمات اداری شهر' && v.servicePlaceType === 'مناطق' &&
    p.inferred.indexOf('contractType') >= 0 && p.inferred.indexOf('servicePlaceType') >= 0,
    v.contractType + ' / ' + v.servicePlaceType);
  check('حکم: نوع و بازهٔ اعتبار', v.decreeType === 'تجدید قرارداد' &&
    v.decreeStart === '14050701' && v.decreeEnd === '14051229');
  check('«تاریخ آخرین حکم» پر نمی‌شود (مرحلهٔ گردش‌کار است)', v.decreeDate === undefined);
  check('ایثارگری: همه «خیر» → «ندارد»', v.veteran === 'ندارد', v.veteran);
  check('شمارهٔ حساب و بیمه هیچ‌جا نمی‌نشیند',
    !JSON.stringify(v).includes('111122223333') && !JSON.stringify(v).includes('99887766'));
  check('ولی گفته می‌شود که خوانده و کنار گذاشته شد',
    p.skipped.indexOf('شماره حساب') >= 0 && p.skipped.indexOf('شماره بیمه') >= 0 &&
    p.skipped.indexOf('آدرس') < 0, p.skipped.join('، '));
  check('هیچ سطری بی‌تکلیف نماند', p.unknown === 0, p.unknown);

  console.log('\n— شکل‌های دیگر: «برچسب: مقدار»، جدول، ایثارگرِ واقعی —');
  const q = await page.evaluate(() => {
    const a = window.Paste.parse([
      'نام و نام خانوادگی: سید محمد حسینی', 'کد ملی: ۰۰۹۸۷۶۵۴۳۲',
      'تاریخ تولد : ۱۳۶۵/۱۱/۰۲', 'مدرک تحصیلی: کارشناسی', 'جنسیت: آقا',
      'وضعیت تأهل: متأهل'
    ].join('\n')).values;
    const b = window.Paste.parse(
      'نام\tزهرا\tنام خانوادگی\tامینی\n' +
      'واحد سازمانی\t\tمحل خدمت\tمعاونت شهرسازی\n' +
      'جانباز\tبله\tدرصد جانبازی\t25\nرزمنده\tبله\tمدت رزمندگی\t18 ماه\nبسیجی\tخیر\tمدت بسیج\t0'
    ).values;
    return { a, b,
      n1: window.Paste.splitName('محمد رضا احمدی'),
      n2: window.Paste.splitName('علی اکبری نژاد'),
      short: window.Paste.looksLikeProfile('۰۰۱۲۳۴۵۶۷۹'),
      prof: window.Paste.looksLikeProfile('کد ملی\n0012345679\nنام پدر\nکامران\nجنسیت\nمرد') };
  });
  check('«برچسب: مقدار» با ارقام فارسی', q.a.nationalId === '0098765432' &&
    q.a.birthDate === '13651102', q.a.nationalId + ' ' + q.a.birthDate);
  check('«سید محمد» نام است', q.a.firstName === 'سید محمد' && q.a.lastName === 'حسینی',
    q.a.firstName + ' / ' + q.a.lastName);
  check('هم‌معناها به گزینهٔ فهرست می‌رسند', q.a.education === 'لیسانس' &&
    q.a.gender === 'مرد' && q.a.maritalStatus === 'متاهل',
    [q.a.education, q.a.gender, q.a.maritalStatus].join('، '));
  check('جدولِ تب‌دار، با خانهٔ خالی', q.b.firstName === 'زهرا' && q.b.lastName === 'امینی' &&
    q.b.orgUnit === undefined && q.b.servicePlace === 'معاونت شهرسازی',
    JSON.stringify([q.b.firstName, q.b.orgUnit, q.b.servicePlace]));
  check('ایثارگری: فقط «بله»ها، با عددِ خودِ سامانه',
    q.b.veteran === 'جانباز (درصد: 25)، رزمنده (مدت: 18 ماه)', q.b.veteran);
  check('«محمد رضا» یک نام است، «علی» تنها هم', q.n1.firstName === 'محمد رضا' &&
    q.n2.firstName === 'علی' && q.n2.lastName === 'اکبری نژاد');
  check('یک عدد پروفایل نیست، چند برچسب هست', !q.short && q.prof);

  // ============================================================ پنجره
  console.log('\n— پنجره: پیش‌نمایش، تیک‌ها، ریختن در فرم —');
  const before = await page.evaluate(() => window.Model.state.cases.length);
  const dlg = await page.evaluate(async (t) => {
    window.App.newCase();
    await new Promise(r => setTimeout(r, 600));
    const set = (k, val) => {
      const n = document.querySelector('[data-field="' + k + '"]').querySelector('input, select');
      n.value = val; n.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('caseNo', '1405777');
    set('lastName', 'نیک پور');           // همان، با فاصله به‌جای نیم‌فاصله
    set('fatherName', 'کیوان');           // ناهمخوان — کاربر نوشته
    const btn = document.querySelector('.paste-btn');
    if (!btn) return { noBtn: true };
    btn.click();
    await new Promise(r => setTimeout(r, 200));
    const area = document.querySelector('.paste-area');
    area.value = t;
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const rows = [...document.querySelectorAll('.paste-table tbody tr')].map(tr => ({
      label: tr.querySelector('th').textContent,
      checked: tr.querySelector('input[type=checkbox]').checked,
      disabled: tr.querySelector('input[type=checkbox]').disabled,
      val: tr.querySelector('.paste-val').value,
      note: (tr.querySelector('.paste-notes') || {}).textContent || ''
    }));
    const skip = (document.querySelector('.paste-skip') || {}).textContent || '';
    const apply = [...document.querySelectorAll('.modal-foot .btn')].pop();
    const applyText = apply.textContent;
    apply.click();
    await new Promise(r => setTimeout(r, 500));
    const v = k => {
      const b = document.querySelector('[data-field="' + k + '"]');
      return b ? (b.querySelector('input, textarea, select') || {}).value : null;
    };
    return {
      rows, skip, applyText,
      modalGone: !document.querySelector('.paste-area'),
      form: { firstName: v('firstName'), lastName: v('lastName'), fatherName: v('fatherName'),
        nationalId: v('nationalId'), gender: v('gender'), hireDate: v('hireDate'),
        decreeType: v('decreeType'), veteran: v('veteran'), contractType: v('contractType'),
        decreeDate: v('decreeDate'), caseNo: v('caseNo') },
      decreeOpen: !!document.querySelector('section.form-block[data-block="decree"]'),
      flashed: document.querySelectorAll('.field.is-carried').length,
      dirty: document.querySelector('.dirty-chip').style.display !== 'none',
      toast: document.querySelector('#toast').textContent
    };
  }, PROFILE);
  if (dlg.noBtn) { check('دکمهٔ چسباندن در بخش مشخصات فرد هست', false); }
  else {
    const row = l => dlg.rows.find(r => r.label === l) || {};
    check('دکمه و پیش‌نمایش', dlg.rows.length === 24, dlg.rows.length + ' سطر');
    check('فیلدِ خالی: تیک‌خورده', row('نام').checked && row('کد ملی').checked);
    check('همان مقدار: خاکستری', row('نام خانوادگی').disabled &&
      /همین را دارد/.test(row('نام خانوادگی').note));
    check('مقدارِ دیگری در فرم: تیک نخورده، با توضیح', !row('نام پدر').checked &&
      /در فرم: کیوان/.test(row('نام پدر').note), row('نام پدر').note);
    check('تاریخ‌ها خوانا نشان داده می‌شوند', row('تاریخ استخدام').val === '۱۳۹۸/۰۲/۰۱',
      row('تاریخ استخدام').val);
    check('آنچه نوشته نمی‌شود، با نام گفته می‌شود — بی‌مقدار',
      /شماره حساب/.test(dlg.skip) && !/111122223333/.test(dlg.skip), dlg.skip.slice(0, 60));
    check('دکمه می‌گوید چند فیلد', /ریختن .+ فیلد در فرم/.test(dlg.applyText), dlg.applyText);
    check('در فرم نشست', dlg.modalGone && dlg.form.firstName === 'بهرام' &&
      dlg.form.nationalId === '0012345679' && dlg.form.gender === 'مرد' &&
      dlg.form.contractType === 'شرکت خدمات اداری شهر', JSON.stringify(dlg.form));
    check('دست‌نوشتهٔ کاربر ماند', dlg.form.fatherName === 'کیوان' &&
      dlg.form.lastName === 'نیک پور' && dlg.form.caseNo === '1405777');
    check('بخشِ «حکم کارگزینی و ایثارگری» باز و پر شد', dlg.decreeOpen &&
      dlg.form.decreeType === 'تجدید قرارداد' && dlg.form.veteran === 'ندارد');
    check('«تاریخ آخرین حکم» خالی ماند', !dlg.form.decreeDate);
    check('فیلدهای پرشده روشن می‌شوند و فرم «ذخیره‌نشده» است',
      dlg.flashed >= 20 && dlg.dirty, dlg.flashed + ' فیلد');
  }
  const after = await page.evaluate(() => window.Model.state.cases.length);
  check('تا «ذخیره» نخورده، پرونده‌ای ساخته نشده', after === before);

  const saved = await page.evaluate(async () => {
    document.querySelector('.case-save').click();
    await new Promise(r => setTimeout(r, 1200));
    const rec = window.Model.state.cases.filter(c => c.caseNo === '1405777')[0];
    return rec ? { json: JSON.stringify(rec), birthDate: rec.birthDate,
      decreeEnd: rec.decreeEnd, fieldOfStudy: rec.fieldOfStudy, hireDate: rec.hireDate } : null;
  });
  check('ذخیره شد، با تاریخ‌های درست', saved && saved.birthDate === '13700315' &&
    saved.decreeEnd === '14051229' && saved.hireDate === '13980201' &&
    saved.fieldOfStudy === 'مدیریت دولتی', saved && JSON.stringify([saved.birthDate, saved.decreeEnd]));
  check('و شمارهٔ حساب در پرونده نیست', saved && !saved.json.includes('111122223333') &&
    !saved.json.includes('99887766'));

  // ===================================================== چسباندن مستقیم
  console.log('\n— چسباندن مستقیم در یک خانهٔ فرم —');
  const direct = await page.evaluate(async (t) => {
    window.App.newCase();
    await new Promise(r => setTimeout(r, 600));
    const input = document.querySelector('[data-field="nationalId"] input');
    input.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    input.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 300));
    const area = document.querySelector('.paste-area');
    const out = { opened: !!area, prefilled: area ? area.value.length === t.length : false,
      rows: document.querySelectorAll('.paste-table tbody tr').length,
      inputLeft: input.value, prevented: ev.defaultPrevented };
    // یک مقدارِ تنها هم چسبیدنی است، بی پنجره
    if (area) document.querySelector('.modal-head .icon-btn').click();
    const dt2 = new DataTransfer();
    dt2.setData('text/plain', '0012345679');
    const ev2 = new ClipboardEvent('paste', { clipboardData: dt2, bubbles: true, cancelable: true });
    input.dispatchEvent(ev2);
    out.singlePrevented = ev2.defaultPrevented;
    out.singleNoDialog = !document.querySelector('.paste-area');
    return out;
  }, PROFILE);
  check('متنِ پروفایل پنجره را با همان متن باز می‌کند', direct.opened && direct.prefilled &&
    direct.rows === 24 && direct.prevented && !direct.inputLeft, JSON.stringify(direct));
  check('یک مقدارِ تنها، معمولی چسبانده می‌شود', !direct.singlePrevented && direct.singleNoDialog);

  // ============================================== حکم به پروندهٔ بعدی نمی‌رود
  const carry = await page.evaluate(() => window.Person.carryFields());
  check('حکم از پروندهٔ قبلی برده نمی‌شود، تولد و رشته چرا',
    carry.indexOf('decreeType') < 0 && carry.indexOf('decreeEnd') < 0 &&
    carry.indexOf('birthDate') >= 0 && carry.indexOf('fieldOfStudy') >= 0 &&
    carry.indexOf('veteran') >= 0);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
