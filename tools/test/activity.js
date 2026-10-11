/*
 * خروجی کارکرد روزانه — برای برنامهٔ دیگر.
 *
 * این خروجی قرار است جای دیگری خوانده و وارد شود، پس شکلش قرارداد است
 * نه سلیقه: کلیدها ثابت‌اند، روزِ خالی سطر خودش را دارد، و هر شمارنده
 * می‌گوید از کجا آمده.
 *
 * اجرا:  node tools/test/activity.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
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
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR', acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await bootApp(page, APP);

  // ================================================== فهرست کنش‌ها
  console.log('\n— قرارداد: کلیدها ثابت و خودتوضیح —');

  const cat = await page.evaluate(() => {
    const A = window.Activity;
    const keys = A.ACTIONS.map(a => a.key);
    const groups = A.GROUPS.map(g => g.key);
    const sources = A.SOURCES.map(s => s.key);
    /* هر رویدادی که برنامه در تاریخچه می‌نویسد، باید در فهرست باشد —
       وگرنه کاری انجام می‌شود و در خروجی دیده نمی‌شود. */
    const written = ['create', 'update', 'delete', 'import', 'restore',
      'doc-add', 'doc-version', 'doc-remove', 'doc-folder', 'doc-person',
      'doc-batch', 'doc-attach', 'doc-sync', 'doc-edit', 'note-add',
      'note-done', 'note-remove', 'task-add', 'task-remove', 'task-done',
      'task-cancel', 'task-skip', 'checklist', 'stage', 'bulk', 'session',
      'form'];
    /* یا از تاریخچه شمرده می‌شود، یا صریحاً گفته شده که جای دیگری
       شمرده می‌شود. حالت سومی — «نه اینجا نه آنجا» — نباید باشد. */
    const mapped = A.ACTIONS.filter(a => a.source === 'history')
      .map(a => a.from).concat(Object.keys(A.COUNTED_ELSEWHERE));
    return {
      n: keys.length,
      dupes: keys.filter((k, i) => keys.indexOf(k) !== i),
      shaped: A.ACTIONS.every(a => a.key && a.label && a.group && a.source && a.from),
      latinKeys: keys.every(k => /^[a-z][a-zA-Z.]+$/.test(k)),
      badGroup: A.ACTIONS.filter(a => groups.indexOf(a.group) < 0).map(a => a.key),
      badSource: A.ACTIONS.filter(a => sources.indexOf(a.source) < 0).map(a => a.key),
      missing: written.filter(k => mapped.indexOf(k) < 0),
      // هر فیلد تاریخِ گردش‌کار هم باید یک کنش داشته باشد
      milestonesMissing: (window.MILESTONES || []).map(m => m.key)
        .filter(k => !A.ACTIONS.some(a => a.source === 'case' && a.from === k))
    };
  });
  check('کلیدها یکتا و لاتین‌اند', !cat.dupes.length && cat.latinKeys,
    cat.n + ' کنش' + (cat.dupes.length ? ' — تکراری: ' + cat.dupes.join(',') : ''));
  check('هر کنش، برچسب و گروه و منبع دارد',
    cat.shaped && !cat.badGroup.length && !cat.badSource.length,
    cat.badGroup.concat(cat.badSource).join(',') || 'همه درست');
  check('هر رویدادی که برنامه ثبت می‌کند، یا شمرده می‌شود یا صریحاً کنار گذاشته شده',
    !cat.missing.length, cat.missing.join('، ') || 'هیچ‌کدام جا نمانده');
  check('هر مرحلهٔ گردش‌کار هم کنشِ خودش را دارد',
    !cat.milestonesMissing.length,
    cat.milestonesMissing.join('، ') || 'هر ۲۱ تاریخ');

  // ============================================ روزِ خالی هم سطر دارد
  console.log('\n— روزی که کاری نشده، خودش داده است —');

  const rows = await page.evaluate(() => {
    const A = window.Activity, J = window.J;
    const from = J.addDays(J.today(), -13), to = J.today();
    const d = A.daily(from, to);
    return {
      n: d.length,
      first: d[0].date, last: d[d.length - 1].date,
      gaps: d.filter((r, i) => i > 0 &&
        J.diffDays(r.date, d[i - 1].date) !== 1).length,
      idle: d.filter(r => !r.worked).length,
      idleShape: d.filter(r => !r.worked).every(r =>
        r.total === 0 && r.cases === 0 && Object.keys(r.counts).length === 0),
      fridays: d.filter(r => r.holiday).map(r => r.weekday),
      weekdaysNamed: d.every(r => !!r.weekday)
    };
  });
  check('برای هر روزِ بازه یک سطر هست، بدون جا افتادن',
    rows.n === 14 && rows.gaps === 0, rows.n + ' سطر، ' + rows.gaps + ' جهش');
  check('روزِ بی‌کار، صفرِ صریح دارد نه سطرِ غایب',
    rows.idle > 0 && rows.idleShape, rows.idle + ' روز بدون کار');
  check('جمعه‌ها تعطیل علامت می‌خورند',
    rows.fridays.length === 2 && rows.fridays.every(d => d === 'جمعه'),
    rows.fridays.join('، '));
  check('نام روز هفته روی هر سطر هست', rows.weekdaysNamed);

  // ================================= کارِ واقعی، در روزِ درست می‌نشیند
  console.log('\n— هر کاری، در روز خودش و با کلید خودش —');

  const work = await page.evaluate(async () => {
    const J = window.J, A = window.Activity, M = window.Model;
    const today = J.today();
    const r = await M.create({
      caseNo: '1405990', status: 'مفتوح رسیدگی',
      firstName: 'سارا', lastName: 'احمدی', nationalId: '0061112223',
      intakeDate: today, deliveryDate: today,
      invitationLetterDate: today, noticeLetterDate: today,
      committeeDate: today, verdictDate: today
    });
    const rec = r.record || r;
    // یک کار، همین امروز بسته می‌شود
    const t = await window.Notes.create({
      kind: 'task', caseId: rec.id, title: 'اسکن مدارک', category: 'بایگانی و اسکن'
    });
    await window.Notes.complete(t);
    // یک فرم اداری ساخته می‌شود
    window.UILetters.printForm('summary', M.get(rec.id), {});
    await new Promise(x => setTimeout(x, 300));

    const p = A.bundle(J.addDays(today, -2), today);
    const row = p.days[p.days.length - 1];
    return {
      date: row.date, worked: row.worked,
      counts: row.counts, bySource: row.bySource,
      // «نامه» در گروه مکاتبات
      letters: p.actions.filter(a => a.group === 'letter')
        .reduce((n, a) => n + (row.counts[a.key] || 0), 0),
      totalsMatch: p.totals.total === p.days.reduce((n, d) => n + d.total, 0),
      caseId: rec.id
    };
  });
  check('ثبت پرونده و تاریخ‌هایش، همان روز شمرده می‌شوند',
    work.counts['case.create'] === 1 && work.counts['case.intake'] === 1 &&
    work.counts['case.assign'] === 1, JSON.stringify(work.counts));
  /* «مکاتبات» سه‌تاست: نامهٔ دعوت، نامهٔ ابلاغ، و خودِ فرمی که ساخته شد. */
  check('نامه‌ها با کلید خودشان می‌آیند',
    work.counts['letter.invite'] === 1 && work.counts['letter.notice'] === 1 &&
    work.letters === 3, work.letters + ' مورد در گروه مکاتبات');
  check('جلسه و رأی هم',
    work.counts['committee.hearing'] === 1 && work.counts['verdict.issue'] === 1);
  check('کارِ بسته‌شده شمرده می‌شود',
    work.counts['task.done'] === 1 && work.bySource.task === 1);
  check('ساختن فرم اداری هم یک کار است و ثبت می‌شود',
    work.counts['form.make'] === 1, JSON.stringify(work.counts['form.make']));
  check('جمعِ کل با جمعِ سطرها می‌خواند', work.totalsMatch);

  // ========================================= هفته و ماه، از روی روزها
  console.log('\n— هفته از شنبه، ماه از اول ماه —');

  const roll = await page.evaluate(() => {
    const A = window.Activity, J = window.J;
    const p = A.bundle('14050101', '14050331');   // سه ماه کامل
    const daySum = p.days.reduce((n, d) => n + d.total, 0);
    return {
      days: p.days.length,
      months: p.months.map(m => ({ label: m.label, days: m.days, from: m.from, to: m.to })),
      weekStarts: p.weeks.slice(1).map(w => {
        const u = J.unpack(w.from);
        return J.weekdayIndex(u.jy, u.jm, u.jd);
      }),
      weekSum: p.weeks.reduce((n, w) => n + w.total, 0),
      monthSum: p.months.reduce((n, m) => n + m.total, 0),
      daySum: daySum
    };
  });
  check('سه ماه اول سال، هرکدام ۳۱ روز',
    roll.days === 93 && roll.months.length === 3 &&
    roll.months.every(m => m.days === 31),
    roll.months.map(m => m.label + ':' + m.days).join(' | '));
  check('هر هفته (جز هفتهٔ ناقصِ اول) از شنبه شروع می‌شود',
    roll.weekStarts.every(i => i === 0), roll.weekStarts.join(','));
  check('جمعِ هفته‌ها و ماه‌ها با جمعِ روزها یکی است',
    roll.weekSum === roll.daySum && roll.monthSum === roll.daySum,
    roll.daySum + ' رویداد');

  // ====================================================== CSV و JSON
  console.log('\n— دو شکل خروجی —');

  const shapes = await page.evaluate(() => {
    const A = window.Activity, J = window.J;
    const p = A.bundle(J.addDays(J.today(), -6), J.today());
    const csv = A.csv(p);
    const lines = csv.split('\n');
    const head = lines[0].split(',');
    return {
      rows: lines.length, days: p.days.length,
      head: head.length,
      hasAll: A.ACTIONS.every(a => head.indexOf(a.key) >= 0),
      cols: lines.slice(1).every(l => l.split(',').length === head.length),
      meta: p.meta,
      sameSchema: p.meta.schema === A.SCHEMA
    };
  });
  check('CSV یک سطر برای هر روز دارد، به‌علاوهٔ سربرگ',
    shapes.rows === shapes.days + 1, shapes.rows + ' سطر');
  check('ستونی برای هر کنش هست و همهٔ سطرها هم‌اندازه‌اند',
    shapes.hasAll && shapes.cols, shapes.head + ' ستون');
  check('شناسنامهٔ خروجی کامل است',
    shapes.meta.schema >= 1 && shapes.meta.calendar === 'jalali' &&
    shapes.meta.dateFormat === 'YYYYMMDD' && !!shapes.meta.generatedAt &&
    !!shapes.meta.note && shapes.sameSchema,
    JSON.stringify(shapes.meta.schema) + ' / ' + shapes.meta.dateFormat);

  // ============================================ صافی کاربر و دامنه
  console.log('\n— صافی‌ها —');

  const filters = await page.evaluate(() => {
    const A = window.Activity, J = window.J;
    const from = J.addDays(J.today(), -2), to = J.today();
    return {
      all: A.bundle(from, to).totals.total,
      mine: A.bundle(from, to, { user: 'کسی که وجود ندارد' }).totals.total,
      wide: A.bundle(from, to, { all: true }).totals.total
    };
  });
  check('صافیِ «فقط کارهای من» واقعاً صافی می‌کند',
    filters.mine < filters.all, filters.mine + ' از ' + filters.all);
  check('دامنهٔ گسترده کمتر از دامنهٔ کار نیست',
    filters.wide >= filters.all, filters.wide + ' ≥ ' + filters.all);

  // ==================================================== در تنظیمات
  console.log('\n— جایش در تنظیمات است —');

  const ui = await page.evaluate(async () => {
    window.UIMisc.settingsDialog(window.App);
    await new Promise(r => setTimeout(r, 600));
    const head = [...document.querySelectorAll('.settings .set-block h4')]
      .find(h => /خروجی کارکرد/.test(h.textContent));
    if (!head) return { missing: true };
    const box = head.parentNode;
    return {
      quick: [...box.querySelectorAll('.act-quick .chip-btn')].map(b => b.textContent),
      dates: box.querySelectorAll('.act-range .date-field').length,
      checks: box.querySelectorAll('.act-check input').length,
      summary: box.querySelector('.act-summary').textContent.replace(/\s+/g, ' '),
      buttons: [...box.querySelectorAll('.btn')].map(b => b.textContent)
    };
  });
  check('بخش «خروجی کارکرد روزانه» در تنظیمات هست', !ui.missing);
  check('بازه‌های آماده و دو تاریخ و دو صافی دارد',
    ui.quick.length === 5 && ui.dates === 2 && ui.checks === 2,
    ui.quick.join(' | '));
  check('پیش از گرفتن خروجی می‌گوید چه چیزی در آن است',
    /روز کاری/.test(ui.summary) && /روز بدون کار/.test(ui.summary),
    ui.summary.slice(0, 80));
  check('هر سه خروجی در دسترس است',
    ui.buttons.some(b => /JSON/.test(b)) && ui.buttons.some(b => /CSV/.test(b)) &&
    ui.buttons.some(b => /کپی/.test(b)), ui.buttons.join(' | '));

  const dl = page.waitForEvent('download');
  await page.evaluate(() => {
    const head = [...document.querySelectorAll('.settings .set-block h4')]
      .find(h => /خروجی کارکرد/.test(h.textContent));
    [...head.parentNode.querySelectorAll('.btn')]
      .find(b => b.textContent === 'خروجی JSON').click();
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'act-'));
  const file = path.join(dir, 'karkard.json');
  const got = await dl;
  await got.saveAs(file);
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { parsed = null; }
  check('دکمه، فایل JSON سالم می‌دهد',
    !!parsed && Array.isArray(parsed.days) && Array.isArray(parsed.actions) &&
    parsed.days.length > 0,
    got.suggestedFilename() + ' — ' +
    (parsed ? parsed.days.length + ' روز، ' + parsed.actions.length + ' کنش' : 'خراب'));
  check('نامش می‌گوید مالِ کدام بازه است',
    /^karkard-\d{8}-\d{8}\.json$/.test(got.suggestedFilename()),
    got.suggestedFilename());

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
