/*
 * کارکرد: زمان‌سنج، رویدادها، صفحهٔ کارها و گزارش کار.
 *
 *   ۱) زمان‌سنج فقط کارِ فعال را می‌شمارد: پرونده‌ای که باز است، با
 *      کلیک و تایپ؛ بی‌کاری شمرده نمی‌شود.
 *   ۲) ویرایش، فرم، مینوت و کارِ ثبت‌شدهٔ دستی، همه در کارکرد می‌آیند.
 *   ۳) روزهای پیش از زمان‌سنج، زمانِ «برآورد» دارند.
 *   ۴) صفحهٔ کارها: سرِ صفحه با زمانِ امروز، ستونِ کارکرد، ثبت کار
 *      انجام‌شده؛ تبِ گزارش کار با جزئیات و خروجی اکسل.
 *   ۵) «بایگانی» و «اشخاص» در «⋯»؛ نام سایت با حرف بزرگ.
 *
 * اجرا:  node tools/test/worklog.js
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
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);
  // مرورگرِ بی‌سر فوکوس نمی‌گیرد؛ در مرورگرِ واقعی پنجرهٔ باز فوکوس دارد
  await page.evaluate(() => { document.hasFocus = () => true; });

  // ===================================================== زمان‌سنج
  console.log('— زمان‌سنج —');
  const tl = await page.evaluate(async () => {
    const M = window.Model, T = window.Timelog, J = window.J;
    const rec = M.state.cases[0];
    window.App.openCase(rec.id);
    await new Promise(r => setTimeout(r, 600));
    const before = T.forCase(rec.id, J.today(), J.today());
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    for (let i = 0; i < 4; i++) T.tick();
    const active = T.forCase(rec.id, J.today(), J.today()) - before;
    T._idle(T.IDLE + 60);               // بیش از ده دقیقه بی‌کاری
    T.tick(); T.tick();
    const idle = T.forCase(rec.id, J.today(), J.today()) - before - active;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    window.App.goList();
    await new Promise(r => setTimeout(r, 300));
    T.tick();
    const list = (T.range(J.today(), J.today())[J.today()] || {})['v:list'] || 0;
    await T.save();
    const stored = window.Store.metaGet('timelog', {});
    return { id: rec.id, active, idle, list, ctx: T.context(),
      stored: !!(stored[J.today()] && stored[J.today()]['c:' + rec.id]),
      start: (stored[J.today()] || {})._s };
  });
  check('کارِ فعال روی پرونده شمرده می‌شود', tl.active === 60, tl.active + ' ثانیه');
  check('بی‌کاری شمرده نمی‌شود', tl.idle === 0, tl.idle + ' ثانیه');
  check('بیرون از پرونده، به همان صفحه نسبت داده می‌شود', tl.list === 15 && tl.ctx === 'v:list');
  check('در انبار (و فایل دیتابیس) ذخیره می‌شود، با ساعت شروع', tl.stored && /^\d\d:\d\d$/.test(tl.start || ''),
    tl.start);

  // ================================================= کارکرد از رویدادها
  console.log('\n— همهٔ کارها در کارکرد —');
  const wl = await page.evaluate(async (id) => {
    const M = window.Model, N = window.Notes, J = window.J, WL = window.Worklog;
    const rec = M.get(id), other = M.state.cases[1];
    await M.update(id, Object.assign({}, M.strip(rec), { notes: 'یادداشتِ آزمون', reportSubject: 'موضوع تازه' }));
    M.addHistory('form', rec, [], 'خلاصهٔ پرونده — چاپ');
    M.addHistory('minute', rec, [], 'مینوت دعوت به کمیته — کپی');
    M.addHistory('minute', rec, [], 'مینوت دعوت به جلسه — کپی');
    await N.create({ kind: 'task', title: 'تماس با واحد', caseId: other.id, done: true, minutes: 20 });
    await N.create({ kind: 'task', title: 'جلسهٔ هماهنگی', done: true, minutes: 45 });
    // دو روز پیش، پیش از زمان‌سنج: فقط رویداد
    const old = new Date(Date.now() - 2 * 86400e3);
    [0, 6, 13].forEach(m => {
      const h = M.addHistory('update', other, [{ field: 'notes', label: 'توضیحات', from: '', to: 'x' }], '');
      h.at = new Date(old.getTime() + m * 60e3).toISOString();
    });
    const t = J.today();
    const today = WL.build(t, t);
    const c = today.cases.find(x => x.id === id);
    const o = today.cases.find(x => x.id === other.id);
    const free = today.cases.find(x => !x.id);
    const past = WL.build(J.addDays(t, -2), J.addDays(t, -2)).days[0];
    return {
      sec: c && c.sec, edits: c && c.counts.edit, fields: c && c.fields, forms: c && c.counts.form,
      minutes: c && c.counts.minute, otherManual: o && o.manualSec, freeManual: free && free.manualSec,
      dayManual: today.days[0].manualSec, total: today.totals.sec, tasksDone: today.days[0].tasksDone,
      past: { est: past.estimated, sec: past.sec, events: past.events },
      dur: WL.dur(4500), first: today.cases[0] && today.cases[0].total
    };
  }, tl.id);
  check('ویرایشِ پرونده با تعداد فیلدهایش', wl.edits >= 1 && wl.fields >= 2, wl.edits + ' ویرایش، ' + wl.fields + ' فیلد');
  check('فرم و مینوت جزو کار شمرده می‌شوند', wl.forms === 1 && wl.minutes === 2);
  check('زمانِ واقعیِ پرونده از زمان‌سنج', wl.sec === 60, wl.sec + ' ثانیه');
  check('کارِ ثبت‌شدهٔ دستی، با زمانش، روی پرونده و بیرون از آن',
    wl.otherManual === 1200 && wl.freeManual === 2700 && wl.dayManual === 3900);
  check('کارِ انجام‌شده در شمار امروز', wl.tasksDone >= 2, wl.tasksDone);
  check('روزِ پیش از زمان‌سنج: زمانِ برآورد از فاصلهٔ رویدادها', wl.past.est && wl.past.sec > 0 && wl.past.events === 3,
    JSON.stringify(wl.past));
  check('نمایش زمان به فارسی', wl.dur === '۱ ساعت و ۱۵ دقیقه', wl.dur);

  // ======================================================= صفحهٔ کارها
  console.log('\n— صفحهٔ کارها —');
  const ui = await page.evaluate(async (id) => {
    window.App.state.taskTab = 'work';
    window.App.goTasks();
    await new Promise(r => setTimeout(r, 700));
    const top = document.querySelector('.tk-top');
    const panel = document.querySelector('.wr-day');
    const caseRows = [...panel.querySelectorAll('.wr-case')];
    const no = window.U.toLatinDigits(window.Model.get(id).caseNo || '');
    const first = caseRows.find(d => d.querySelector('.reg-no') && d.querySelector('.reg-no').textContent === no);
    first.open = true;
    await new Promise(r => setTimeout(r, 100));
    const out = {
      top: !!top, line: top.querySelector('.tk-line').textContent,
      kpi: top.querySelectorAll('.tk-kpi').length,
      total: panel.querySelector('.wr-total-n b').textContent,
      cases: caseRows.length, free: !!panel.querySelector('.wr-case.is-free'),
      evs: first.querySelectorAll('.wr-ev').length,
      chips: first.querySelector('.wr-chips').textContent,
      list: !!document.querySelector('.tk-main .task-bucket, .tk-main .b-checklist'),
      tools: !!document.querySelector('.task-hero .btn.primary')
    };
    // روز قبل
    panel.querySelector('.wr-step-b').click();
    await new Promise(r => setTimeout(r, 300));
    out.prev = document.querySelector('.wr-step-d span').textContent;
    window.App.state.logDay = '';
    return out;
  }, tl.id);
  check('سرِ صفحه: زمانِ امروز و هفت کاشی', ui.top && /امروز .*کار/.test(ui.line) && ui.kpi === 7, ui.line);
  check('ستونِ کارکرد: پرونده‌ها با زمان، و «بیرون از پرونده‌ها»', ui.cases >= 2 && ui.free && /ساعت|دقیقه/.test(ui.total),
    ui.total + ' — ' + ui.cases + ' پرونده');
  check('هر پرونده باز می‌شود و رویدادهایش با ساعت دیده می‌شوند', ui.evs >= 3 && /فرم/.test(ui.chips) && /مینوت/.test(ui.chips),
    ui.chips);
  check('فهرستِ کارها کنارش سرِ جایش است', ui.list && ui.tools);
  check('دکمهٔ روز قبل', ui.prev && ui.prev.length > 4, ui.prev);

  const logged = await page.evaluate(async () => {
    window.App.goTasks();
    await new Promise(r => setTimeout(r, 400));
    [...document.querySelectorAll('.wr-day .btn.primary')].find(b => /ثبت کار انجام‌شده/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    const m = document.querySelector('.task-modal');
    const noDue = ![...m.querySelectorAll('.field-label')].some(l => /سررسید/.test(l.textContent));
    const t = m.querySelector('.task-title-input');
    t.value = 'مطالعهٔ پروندهٔ کاغذی'; t.dispatchEvent(new Event('input'));
    const mi = m.querySelector('.task-min');
    mi.value = '35'; mi.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('.modal-foot .btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 500));
    const task = window.Notes.all().find(n => n.title === 'مطالعهٔ پروندهٔ کاغذی');
    return { noDue, done: task && task.status, minutes: task && task.minutes,
      inPanel: /مطالعهٔ پروندهٔ کاغذی/.test(document.querySelector('.wr-day').textContent) ||
        /۳۵|۱ ساعت|۲ ساعت/.test(document.querySelector('.wr-total').textContent) };
  });
  check('«ثبت کار انجام‌شده»: بی‌سررسید، با زمان، و بسته‌شده', logged.noDue && logged.done === 'done' && logged.minutes === 35,
    JSON.stringify(logged));

  // ======================================================== گزارش کار
  console.log('\n— گزارش کار —');
  const rep = await page.evaluate(async () => {
    let downloaded = null;
    const orig = window.U.download;
    window.U.download = (name, blob) => { downloaded = { name, size: blob.size }; };
    window.App.state.taskTab = 'report';
    window.App.state.wrRange = 'month';
    window.App.render();
    await new Promise(r => setTimeout(r, 700));
    const wr = document.querySelector('.wr');
    const out = {
      tiles: wr.querySelectorAll('.wr-tiles:not(.small) .wr-tile').length,
      cols: wr.querySelectorAll('.wr-col').length,
      days: window.J.diffDays(window.J.today(), window.Karnameh.range('month').from) + 1,
      rows: wr.querySelectorAll('.wr-tr').length,
      secs: [...wr.querySelectorAll('.wr-sec-head h3')].map(h => h.textContent)
    };
    const tr = wr.querySelector('.wr-tr');
    tr.click();
    out.opened = tr.nextElementSibling.style.display !== 'none' && tr.nextElementSibling.querySelectorAll('.wr-ev').length > 0;
    [...wr.querySelectorAll('.wr-range .btn')].find(b => /اکسل/.test(b.textContent)).click();
    out.excel = downloaded;
    window.U.download = orig;
    window.App.state.taskTab = 'work';
    return out;
  });
  check('کاشی‌های گزارش', rep.tiles === 8, rep.tiles);
  check('یک ستون برای هر روزِ بازه', rep.cols === rep.days, rep.cols + ' از ' + rep.days);
  check('پرونده به پرونده، و هر سطر با رویدادهایش باز می‌شود', rep.rows >= 2 && rep.opened);
  check('بخش‌ها: زمان، پرونده‌ها، نوع کار، کارها، روز به روز',
    ['زمان، روز به روز', 'پرونده به پرونده', 'چه نوع کاری', 'کارها', 'روز به روز'].every(s => rep.secs.indexOf(s) >= 0),
    rep.secs.join('، '));
  check('خروجی اکسل', rep.excel && /\.xlsx$/.test(rep.excel.name) && rep.excel.size > 2000,
    rep.excel && rep.excel.name);

  // =============================================== منو و نام سایت
  console.log('\n— منو و پانویس —');
  const nav = await page.evaluate(async () => {
    const navs = [...document.querySelectorAll('.main-nav .nav-btn')].map(b => b.dataset.nav);
    const more = document.querySelector('.topbar .more-btn');
    const shown = getComputedStyle(more).display !== 'none';
    more.click();
    await new Promise(r => setTimeout(r, 300));
    const items = [...document.querySelectorAll('.sheet-item b')].map(b => b.textContent);
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    window.App.goArchive();
    await new Promise(r => setTimeout(r, 300));
    const active = more.classList.contains('active');
    window.App.goTasks();
    return { navs, shown, items, active,
      site: (document.querySelector('.app-footer .ft-site .ft-chip-t') || {}).textContent };
  });
  check('«بایگانی» و «اشخاص» از نوار بالا رفتند', nav.navs.indexOf('archive') < 0 && nav.navs.indexOf('people') < 0,
    nav.navs.join(','));
  check('و در «⋯» هستند (روی صفحهٔ پهن هم)', nav.shown && nav.items.indexOf('بایگانی اسناد') >= 0 &&
    nav.items.indexOf('اشخاص') >= 0);
  check('در بایگانی، «⋯» روشن است', nav.active);
  check('نام سایت با حرف بزرگ', /^[A-Z]/.test(nav.site || ''), nav.site);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
