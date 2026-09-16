/*
 * تست لایهٔ «شخص»: یک کارمند ممکن است چند پرونده داشته باشد.
 * اجرا:  node tools/test/person.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/** چند پروندهٔ ساختگی برای دو کارمند مشخص می‌سازد */
const SEED = `
(async function () {
  // دادهٔ نمونه کد ملی یکسان دارد؛ برای تست، هویت‌ها را واقعی می‌کنیم
  const cases = window.Model.state.cases.slice();
  for (let i = 0; i < cases.length; i++) {
    await window.Model.update(cases[i].id, Object.assign(
      {}, window.Model.strip(cases[i]),
      { nationalId: '900000' + String(1000 + i), personnelCode: '' }));
  }
  // دو نفر با چند پرونده
  const mk = (caseNo, nid, first, last, extra) => window.Model.create(Object.assign({
    caseNo: caseNo, nationalId: nid, firstName: first, lastName: last,
    fatherName: 'حسن', status: 'مفتوح رسیدگی', caseType: 'تنبیه',
    orgUnit: 'منطقه 7', expert: 'نوروزی'
  }, extra));
  await mk('1405801', '0012345678', 'رضا', 'کریمی', { intakeDate: '14040310' });
  await mk('1405802', '0012345678', 'رضا', 'کریمی', { intakeDate: '14040720' });
  await mk('1405803', '0012345678', 'رضا', 'کريمي', {   // ی/ک عربی عمداً
    intakeDate: '14050115', status: 'ابلاغ و مختومه شد', committeeDate: '14050320' });
  await mk('1405810', '0087654321', 'مریم', 'نادری', { intakeDate: '14050201' });
  return true;
})()
`;


/** صفحهٔ نخست حالا کارتابل است؛ تست‌ها با فهرست پرونده‌ها کار می‌کنند */
async function openList(page) {
  await page.waitForSelector('.worklist, .lock-screen, .tr', { timeout: 20000 });
  if (await page.$('.lock-screen')) return;
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr', { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await openList(page);
  await page.evaluate(SEED);

  console.log('\n— گروه‌بندی پرونده‌ها به شخص —');
  const grouped = await page.evaluate(() => {
    const people = window.Person.all();
    const reza = people.find(p => p.nationalId === '0012345678');
    const maryam = people.find(p => p.nationalId === '0087654321');
    return {
      total: people.length,
      cases: window.Model.state.cases.length,
      rezaCases: reza ? reza.caseCount : 0,
      rezaOpen: reza ? reza.openCount : 0,
      rezaClosed: reza ? reza.closedCount : 0,
      rezaOrder: reza ? reza.cases.map(c => c.caseNo) : [],
      maryamCases: maryam ? maryam.caseCount : 0,
      sumCases: people.reduce((a, p) => a + p.caseCount, 0)
    };
  });
  check('چند پروندهٔ یک کد ملی زیر یک شخص جمع شد',
    grouped.rezaCases === 3 && grouped.maryamCases === 1,
    'رضا ' + grouped.rezaCases + ' • مریم ' + grouped.maryamCases);
  check('هر پرونده دقیقاً یک بار شمرده می‌شود',
    grouped.sumCases === grouped.cases,
    grouped.sumCases + ' == ' + grouped.cases);
  check('باز و مختومه جدا شمرده می‌شوند',
    grouped.rezaOpen === 2 && grouped.rezaClosed === 1,
    grouped.rezaOpen + ' باز، ' + grouped.rezaClosed + ' مختومه');
  check('پرونده‌ها به ترتیب تاریخ ورود مرتب‌اند',
    JSON.stringify(grouped.rezaOrder) === JSON.stringify(['1405801', '1405802', '1405803']),
    grouped.rezaOrder.join(' → '));

  console.log('\n— تشخیص ناسازگاری هویتی —');
  const conflict = await page.evaluate(() => {
    const p = window.Person.all().find(x => x.nationalId === '0012345678');
    return {
      fields: p.conflicts.map(c => c.field),
      values: p.conflicts.length ? p.conflicts[0].values.map(v => v.value) : []
    };
  });
  check('نام خانوادگی متفاوت با یک کد ملی گزارش شد',
    conflict.fields.indexOf('lastName') >= 0,
    conflict.values.join(' / '));

  console.log('\n— پرونده‌های مرتبط و نمایه —');
  const related = await page.evaluate(() => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1405802');
    const before = window.Model.relatedCases(rec).length;
    return { before: before, key: window.Person.keyOf(rec) };
  });
  check('«پرونده‌های دیگر همین فرد» از لایهٔ شخص می‌آید',
    related.before === 2 && related.key === 'n:0012345678',
    related.before + ' پروندهٔ دیگر، کلید ' + related.key);

  const invalidated = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1405810');
    const before = window.Person.all().length;
    await window.Model.update(rec.id, Object.assign({}, window.Model.strip(rec),
      { nationalId: '0012345678' }));
    const after = window.Person.all().length;
    const p = window.Person.all().find(x => x.nationalId === '0012345678');
    return { before: before, after: after, rezaCases: p.caseCount };
  });
  check('نمایهٔ اشخاص پس از ویرایش کد ملی تازه می‌شود',
    invalidated.after === invalidated.before - 1 && invalidated.rezaCases === 4,
    invalidated.before + ' → ' + invalidated.after + ' نفر');

  console.log('\n— تایم‌لاین یکپارچه —');
  const timeline = await page.evaluate(() => {
    const p = window.Person.all().find(x => x.nationalId === '0012345678');
    const tl = window.Person.timeline(p);
    const caseNos = {};
    tl.forEach(i => { caseNos[i.caseNo] = true; });
    return {
      items: tl.length,
      cases: Object.keys(caseNos).length,
      sorted: tl.every((it, i) => i === 0 || tl[i - 1].sortKey <= it.sortKey),
      gaps: window.Person.intervals(p)
    };
  });
  check('رویدادهای همهٔ پرونده‌ها در یک تایم‌لاین جمع شدند',
    timeline.items > 0 && timeline.cases === 4,
    timeline.items + ' رویداد از ' + timeline.cases + ' پرونده');
  check('تایم‌لاین یکپارچه مرتب است', timeline.sorted);
  check('فاصلهٔ بین پرونده‌های پیاپی محاسبه می‌شود',
    timeline.gaps.length === 3 && timeline.gaps.every(g => g >= 0),
    timeline.gaps.join('، ') + ' روز');

  console.log('\n— نمای اشخاص —');
  await page.evaluate(() => window.App.goPeople());
  await page.waitForSelector('.person-card');
  const listView = await page.evaluate(() => ({
    cards: document.querySelectorAll('.person-card').length,
    repeats: document.querySelectorAll('.person-card.repeat').length,
    conflictNotes: document.querySelectorAll('.person-conflict').length
  }));
  check('فهرست اشخاص رندر شد', listView.cards > 0, listView.cards + ' نفر');
  check('افراد چندپرونده‌ای نشان‌دار شدند',
    listView.repeats === 1 && listView.conflictNotes === 1,
    listView.repeats + ' نفر چندپرونده‌ای');

  const search = await page.evaluate(() => {
    window.App.state.q = 'کریمي';        // با ی و ک عربی
    window.App.render();
    return document.querySelectorAll('.person-card').length;
  });
  check('جستجوی اشخاص با ی/ک عربی کار می‌کند', search === 1, search + ' نتیجه');
  await page.evaluate(() => { window.App.state.q = ''; window.App.render(); });

  const personPage = await page.evaluate(() => {
    const p = window.Person.all().find(x => x.nationalId === '0012345678');
    window.App.openPerson(p.key);
    return {
      rows: document.querySelectorAll('.person-case-row').length,
      warn: !!document.querySelector('.person-view .warn'),
      timelineItems: document.querySelectorAll('.person-timeline .tl-item').length,
      caseTags: document.querySelectorAll('.case-tag').length,
      title: (document.querySelector('.case-title') || {}).textContent
    };
  });
  check('صفحهٔ شخص همهٔ پرونده‌هایش را نشان می‌دهد',
    personPage.rows === 4, personPage.rows + ' سطر، عنوان: ' + personPage.title);
  check('هشدار ناسازگاری در صفحهٔ شخص دیده می‌شود', personPage.warn);
  check('هر رویداد تایم‌لاین برچسب پروندهٔ خودش را دارد',
    personPage.timelineItems > 0 && personPage.caseTags === personPage.timelineItems,
    personPage.caseTags + ' برچسب برای ' + personPage.timelineItems + ' رویداد');

  console.log('\n— گزارش‌های شخص‌محور —');
  const report = await page.evaluate(() => {
    window.App.goReport();
    const d = window.App.state.reportData;
    const f = d.findings;
    return {
      people: d.repeat.people,
      buckets: d.repeat.buckets.map(b => b.value),
      bucketSum: d.repeat.buckets.reduce((a, b) => a + b.value, 0),
      repeaters: d.repeat.repeaters.length,
      repeatFinding: f.some(x => x.title === 'افراد با بیش از یک پرونده'),
      concurrent: f.some(x => x.title === 'اشخاص با چند پروندهٔ باز هم‌زمان'),
      identity: f.some(x => x.title === 'ناسازگاری مشخصات هویتی'),
      countIsPeople: (f.find(x => x.title === 'افراد با بیش از یک پرونده') || {}).count,
      cards: document.querySelectorAll('.chart-card').length
    };
  });
  check('جمع سطل‌های تکرار برابر تعداد اشخاص است',
    report.bucketSum === report.people,
    report.bucketSum + ' == ' + report.people + ' نفر');
  check('یافتهٔ تکرار تخلف، «نفر» می‌شمارد نه «پرونده»',
    report.repeatFinding && report.countIsPeople === report.repeaters,
    report.countIsPeople + ' نفر');
  check('یافتهٔ پرونده‌های باز هم‌زمان ساخته شد', report.concurrent);
  check('یافتهٔ ناسازگاری هویتی ساخته شد', report.identity);
  check('کارت «تکرار تخلف» در گزارش هست', report.cards >= 12,
    report.cards + ' کارت');

  console.log('\n— چاپ پروندهٔ شخص —');
  const printed = await page.evaluate(() => {
    const p = window.Person.all().find(x => x.nationalId === '0012345678');
    window.print = () => {};
    window.UIPrint.printPerson(p);
    return {
      sections: document.querySelectorAll('#print-area .p-section').length,
      rows: document.querySelectorAll('#print-area .p-list tr').length
    };
  });
  check('پروندهٔ چاپی شخص ساخته شد',
    printed.sections >= 4 && printed.rows > 4, JSON.stringify(printed));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
