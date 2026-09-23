/*
 * کد ملی که وارد شد، مشخصات خودش را می‌آورد.
 *
 * کارمندی که پروندهٔ دوم پیدا می‌کند، همان نام و نام پدر و کد پرسنلی و
 * واحد سازمانی را دارد. دوباره تایپ کردنشان هم وقت می‌برد و هم غلط
 * می‌آورد — یک بار «منطقه ۵»، یک بار «منطقهٔ پنج»، و بعد گزارش‌ها دو تا
 * واحد می‌شمارند.
 *
 * ولی فقط همین‌ها. هرچه مالِ *این* پرونده است — موضوع گزارش، نوع
 * پرونده، سابقهٔ تخلف، تاریخ‌ها — کپی نمی‌شود.
 *
 * اجرا:  node tools/test/carry.js
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

/** پر کردن یک فیلد فرم، همان‌طور که دست آدم پر می‌کند */
const SET = `(key, value, blur) => {
  const box = document.querySelector('[data-field="' + key + '"]');
  const node = box.querySelector('input, textarea, select');
  node.value = value;
  node.dispatchEvent(new Event('input', { bubbles: true }));
  if (blur) node.dispatchEvent(new Event('change', { bubbles: true }));
}`;

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

  // دو پروندهٔ قبلی از یک نفر؛ بعضی فیلدها فقط در قدیمی‌تر هست
  await page.evaluate(async () => {
    await window.Model.create({
      caseNo: '1403100', status: 'ابلاغ و مختومه شد', nationalId: '0079998887',
      firstName: 'مریم', lastName: 'کاظمی', fatherName: 'حسن', idNumber: '4410',
      gender: 'زن', maritalStatus: 'متاهل', education: 'لیسانس',
      postTitle: 'کارشناس مسئول', payrollPlace: 'ستاد',
      intakeDate: '14030101', reportSubject: 'تخلف ۱۴۰۳'
    });
    await window.Model.create({
      caseNo: '1404700', status: 'مفتوح رسیدگی', nationalId: '0079998887',
      firstName: 'مریم', lastName: 'کاظمی', personnelCode: '55123',
      phone: '09120000000', jobTitle: 'کارشناس', orgUnit: 'منطقه ۵',
      contractType: 'رسمی', hireDate: '13850701', employmentStatus: 'شاغل',
      decreeDate: '14040505', caseType: 'تنبیه',
      reportSubject: 'تخلف ۱۴۰۴', priorRecord: 'سابقهٔ قبلی',
      notes: 'یادداشت پروندهٔ قبلی', pastReporters: 'بازرسی منطقه',
      intakeDate: '14040101'
    });
  });

  // ============================================== لایهٔ شخص، بدون رابط
  console.log('\n— چه چیزی با شخص جابه‌جا می‌شود —');

  const layer = await page.evaluate(() => {
    const P = window.Person;
    const carry = P.carryOver('0079998887');
    const fields = P.carryFields();
    return {
      fields: fields,
      // گروهِ هر فیلدِ جابه‌جاشونده، تا معلوم باشد از کجا آمده
      groups: [...new Set(fields.map(k => window.Model.FIELD_BY_KEY[k].group))],
      count: carry.count,
      values: carry.values,
      // هر فیلد از تازه‌ترین پرونده‌ای که پرش داشته
      fromNewer: carry.values.orgUnit,
      fromOlder: carry.values.postTitle,
      none: P.carryOver('9999999999'),
      empty: P.carryOver('')
    };
  });
  check('فهرستِ جابه‌جاشونده فقط از دو گروهِ «شخص» و «شغل» است',
    layer.groups.length === 2 &&
    layer.groups.indexOf('person') >= 0 && layer.groups.indexOf('job') >= 0,
    layer.groups.join('، ') + ' — ' + layer.fields.length + ' فیلد');
  check('هیچ فیلدی از گزارش و تخلف در این فهرست نیست',
    ['reportSubject', 'caseType', 'priorRecord', 'notes', 'pastReporters',
      'intakeDate', 'status'].every(k => layer.fields.indexOf(k) < 0));
  check('«تاریخ آخرین حکم» جابه‌جا نمی‌شود — یک مرحلهٔ گردش‌کار است',
    layer.fields.indexOf('decreeDate') < 0 &&
    layer.values.decreeDate === undefined);
  check('هر فیلد از تازه‌ترین پرونده‌ای می‌آید که پرش داشته',
    layer.fromNewer === 'منطقه ۵' && layer.fromOlder === 'کارشناس مسئول',
    layer.fromNewer + ' / ' + layer.fromOlder);
  check('دو پروندهٔ قبلی شمرده می‌شوند', layer.count === 2);
  check('کد ملیِ ناشناس یا خالی، چیزی نمی‌آورد',
    layer.none === null && layer.empty === null);

  // =========================================== پر شدن خودکار در فرم
  console.log('\n— در فرمِ پروندهٔ جدید، خودش پر می‌شود —');

  const filled = await page.evaluate(async (setSrc) => {
    const set = eval(setSrc);
    window.App.newCase();
    await new Promise(r => setTimeout(r, 600));
    set('caseNo', '1405999');
    set('lastName', 'کاظمی‌نژاد');       // دست‌نوشتهٔ کاربر
    /* بدون blur: کد ملی ده‌رقمی که کامل شود، همان‌جا پر می‌کند. با ارقام
       فارسی هم باید بشناسد. */
    set('nationalId', '۰۰۷۹۹۹۸۸۸۷');
    await new Promise(r => setTimeout(r, 900));
    const v = k => {
      const b = document.querySelector('[data-field="' + k + '"]');
      return b ? (b.querySelector('input, textarea, select') || {}).value : null;
    };
    return {
      notice: document.querySelector('.warn-box').textContent.replace(/\s+/g, ' '),
      kept: { caseNo: v('caseNo'), nationalId: v('nationalId'), lastName: v('lastName') },
      person: { firstName: v('firstName'), fatherName: v('fatherName'),
        idNumber: v('idNumber'), gender: v('gender'), education: v('education') },
      job: { jobTitle: v('jobTitle'), orgUnit: v('orgUnit'),
        contractType: v('contractType'), hireDate: v('hireDate'),
        postTitle: v('postTitle') },
      caseFields: { caseType: v('caseType'), reportSubject: v('reportSubject'),
        priorRecord: v('priorRecord'), notes: v('notes'),
        pastReporters: v('pastReporters'), decreeDate: v('decreeDate'),
        intakeDate: v('intakeDate'), status: v('status') },
      flashed: document.querySelectorAll('.field.is-carried').length,
      dirty: !!document.querySelector('.dirty-chip') &&
        document.querySelector('.dirty-chip').style.display !== 'none',
      service: (document.querySelector('.svc-inline') || {}).textContent
    };
  }, SET);

  check('چیزی که کاربر تایپ کرده، سرِ جایش می‌ماند',
    filled.kept.caseNo === '1405999' && filled.kept.nationalId === '۰۰۷۹۹۹۸۸۸۷',
    JSON.stringify(filled.kept));
  check('دست‌نوشتهٔ کاربر بازنویسی نمی‌شود',
    filled.kept.lastName === 'کاظمی‌نژاد', filled.kept.lastName);
  check('مشخصات فردی خودکار پر می‌شود',
    filled.person.firstName === 'مریم' && filled.person.fatherName === 'حسن' &&
    filled.person.idNumber === '4410' && filled.person.gender === 'زن' &&
    filled.person.education === 'لیسانس', JSON.stringify(filled.person));
  check('اطلاعات شغلی هم همین‌طور',
    filled.job.jobTitle === 'کارشناس' && filled.job.orgUnit === 'منطقه ۵' &&
    filled.job.contractType === 'رسمی' && filled.job.postTitle === 'کارشناس مسئول' &&
    /1385/.test(filled.job.hireDate || ''), JSON.stringify(filled.job));
  check('هیچ‌چیزی از گزارش و تخلفِ پروندهٔ قبلی کپی نمی‌شود',
    Object.keys(filled.caseFields).every(k => !filled.caseFields[k]),
    JSON.stringify(filled.caseFields));
  check('پیام می‌گوید چه پر شد و چه پر نشد',
    /خودکار پر شد/.test(filled.notice) &&
    /گزارش و تخلفِ این پرونده پر نشد/.test(filled.notice) &&
    /مریم کاظمی/.test(filled.notice),
    filled.notice.slice(0, 90));
  check('فیلدهای پرشده یک لحظه روشن می‌شوند', filled.flashed === 15,
    filled.flashed + ' فیلد');
  check('فرم «ذخیره‌نشده» علامت می‌خورد', filled.dirty);
  check('سابقهٔ کار هم از تاریخ استخدامِ همان شخص درمی‌آید',
    /۲۰ سال/.test(filled.service || ''), filled.service);

  // ==================================================== برگرداندن
  console.log('\n— اگر نخواستید، برمی‌گردد —');

  const undone = await page.evaluate(async () => {
    [...document.querySelectorAll('.warn-box .linkish')]
      .find(b => /برگرداندن/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 500));
    const v = k => (document.querySelector('[data-field="' + k + '"]')
      .querySelector('input, select') || {}).value;
    return {
      firstName: v('firstName'), orgUnit: v('orgUnit'),
      caseNo: v('caseNo'), lastName: v('lastName'),
      notice: document.querySelector('.warn-box').textContent.replace(/\s+/g, ' ')
    };
  });
  check('فیلدهای خودکار خالی می‌شوند',
    !undone.firstName && !undone.orgUnit, JSON.stringify(undone));
  check('ولی دست‌نوشتهٔ کاربر دست نمی‌خورد',
    undone.caseNo === '1405999' && undone.lastName === 'کاظمی‌نژاد');
  check('و پیام می‌گوید چه شد', /برگردانده شد/.test(undone.notice),
    undone.notice.slice(0, 70));

  // ================================================ ذخیره و درستی
  console.log('\n— ذخیره‌شده همان است که دیده می‌شد —');

  const saved = await page.evaluate(async (setSrc) => {
    const set = eval(setSrc);
    set('nationalId', '0079998887', true);   // دوباره، این بار با blur
    await new Promise(r => setTimeout(r, 700));
    document.querySelector('.case-save').click();
    await new Promise(r => setTimeout(r, 1200));
    const rec = window.Model.state.cases.filter(c => c.caseNo === '1405999')[0];
    return rec ? {
      firstName: rec.firstName, lastName: rec.lastName, orgUnit: rec.orgUnit,
      hireDate: rec.hireDate, reportSubject: rec.reportSubject || '',
      caseType: rec.caseType || '', decreeDate: rec.decreeDate || '',
      others: window.Person.get(window.Person.keyOf(rec)).caseCount
    } : null;
  }, SET);
  check('پرونده با مشخصاتِ پرشده ذخیره می‌شود',
    saved && saved.firstName === 'مریم' && saved.orgUnit === 'منطقه ۵' &&
    saved.hireDate === '13850701' && saved.lastName === 'کاظمی‌نژاد',
    JSON.stringify(saved));
  check('و بدون هیچ‌چیز از تخلفِ پروندهٔ قبلی',
    saved && !saved.reportSubject && !saved.caseType && !saved.decreeDate);
  check('حالا این شخص سه پرونده دارد', saved && saved.others === 3,
    saved && saved.others);

  // =========================== هشدار شمارهٔ تکراری را پاک نمی‌کند
  console.log('\n— دو هشدار، یک کادر: نباید همدیگر را پاک کنند —');

  const both = await page.evaluate(async (setSrc) => {
    const set = eval(setSrc);
    window.App.newCase();
    await new Promise(r => setTimeout(r, 600));
    set('caseNo', '1404700', true);          // شمارهٔ تکراری
    await new Promise(r => setTimeout(r, 400));
    const afterDup = document.querySelector('.warn-box').textContent;
    set('nationalId', '1111111111', true);   // کد ملیِ ناشناس
    await new Promise(r => setTimeout(r, 500));
    return {
      dup: /تکراری/.test(afterDup),
      still: /تکراری/.test(document.querySelector('.warn-box').textContent)
    };
  }, SET);
  check('هشدار شمارهٔ تکراری می‌آید', both.dup);
  check('و با وارد کردن کد ملیِ ناشناس پاک نمی‌شود', both.still);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
