/*
 * تست کارها.
 *
 * چیزی که اینجا سنجیده می‌شود، همان حرف کاربر است: «هر پرونده یک‌سری
 * تسک اضافه دارد، و یک‌سری کار هم از بیرون ارجاع می‌شود». پس آزمون‌ها
 * روی همین دو حالت‌اند، به‌علاوهٔ چیزهایی که اگر خراب باشند آمار دروغ
 * می‌گوید: لغو با انجام یکی نشود، و کارِ بی‌پرونده از قلم نیفتد.
 *
 * اجرا:  node tools/test/tasks.js
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

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);

  // ------------------------------------------------------------ مدل
  console.log('\n— مدل کارها —');

  const made = await page.evaluate(async () => {
    const J = window.J, N = window.Notes;
    const caseId = window.Model.state.cases[0].id;
    await N.create({ kind: 'task', title: 'اسکن مدارک', caseId: caseId,
      followUp: J.today() });
    await N.create({ kind: 'task', title: 'پیگیری نامهٔ حراست',
      followUp: J.addDays(J.today(), -3), from: 'رئیس کمیته' });   // عقب‌افتاده
    await N.create({ kind: 'task', title: 'پرینت دستور کار',
      followUp: J.addDays(J.today(), 4), priority: 'urgent' });
    await N.create({ kind: 'task', title: 'بایگانی پرونده‌های سال قبل' });
    await N.create({ kind: 'note', caseId: caseId, text: 'تلفنی تماس گرفته شد.' });
    return {
      tasks: N.tasks({ status: 'open' }).length,
      standalone: N.standalone().length,
      onCase: N.tasks({ caseId: caseId, status: 'open' }).length
    };
  });
  check('کار روی پرونده و کار بیرون از پرونده، هر دو ثبت می‌شوند',
    made.tasks === 4 && made.standalone === 3 && made.onCase === 1,
    made.tasks + ' کار، ' + made.standalone + ' بی‌پرونده');

  const noTitle = await page.evaluate(() =>
    window.Notes.create({ kind: 'task', title: '   ' })
      .then(() => '', e => e.message));
  check('کار بدون عنوان ثبت نمی‌شود', /عنوان/.test(noTitle), noTitle);

  const buckets = await page.evaluate(() => {
    const out = {};
    window.Notes.taskBuckets().forEach(b => { out[b.key] = b.items.length; });
    return out;
  });
  check('سطل‌بندی سررسید درست است',
    buckets.overdue === 1 && buckets.today === 1 && buckets.week === 1 &&
    buckets.someday === 1,
    JSON.stringify(buckets));

  check('هر پنج سطل همیشه برمی‌گردند، حتی خالی',
    Object.keys(buckets).length === 5, Object.keys(buckets).join(','));

  const today = await page.evaluate(() => ({
    due: window.Notes.stats().dueTasks,
    over: window.Notes.stats().overdueTasks,
    titles: window.Notes.todayTasks().map(t => t.title)
  }));
  check('«کارهای امروز» یعنی سررسیدرسیده و عقب‌افتاده، نه بیشتر',
    today.due === 2 && today.over === 1, today.titles.join(' / '));

  /* کارِ بی‌پرونده قبلاً از dueFollowUps می‌افتاد، چون آن تابع پروندهٔ
     هر مورد را لازم داشت. این همان چیزی است که نباید برگردد. */
  const follows = await page.evaluate(() =>
    window.Notes.dueFollowUps(true).map(f => ({
      t: f.note.title || f.note.text, hasCase: !!f.rec
    })));
  check('کار بی‌پرونده هم در سررسیدها می‌آید',
    follows.some(f => f.t === 'پیگیری نامهٔ حراست' && !f.hasCase),
    JSON.stringify(follows.map(f => f.t)));

  // ------------------------------------------------------ لغو ≠ انجام
  console.log('\n— لغو با انجام یکی نیست —');
  const closed = await page.evaluate(async () => {
    const N = window.Notes;
    const a = N.tasks({ status: 'open' }).find(t => t.title === 'اسکن مدارک');
    const b = N.tasks({ status: 'open' }).find(t => t.title === 'پرینت دستور کار');
    await N.complete(a);
    await N.cancelTask(b, 'جلسه لغو شد');
    const r = N.report();
    return {
      done: N.tasks({ status: 'done' }).length,
      cancelled: N.tasks({ status: 'cancelled' }).length,
      open: N.tasks({ status: 'open' }).length,
      rDone: r.done, rCancelled: r.cancelled, rOverdue: r.overdue,
      byFrom: r.byFrom.map(x => x.key)
    };
  });
  check('انجام‌شده و لغوشده جدا شمرده می‌شوند',
    closed.done === 1 && closed.cancelled === 1 && closed.open === 2,
    JSON.stringify(closed));
  check('گزارش هم آنها را قاطی نمی‌کند',
    closed.rDone === 1 && closed.rCancelled === 1 && closed.rOverdue === 1);
  check('گزارش بر اساس ارجاع‌دهنده گروه می‌شود',
    closed.byFrom.indexOf('رئیس کمیته') >= 0, closed.byFrom.join(','));

  const reopened = await page.evaluate(async () => {
    const t = window.Notes.tasks({ status: 'cancelled' })[0];
    await window.Notes.reopen(t);
    return { status: t.status, done: t.done, why: t.cancelReason };
  });
  check('باز کردن دوباره، هم وضعیت و هم علت لغو را پاک می‌کند',
    reopened.status === 'open' && reopened.done === false && !reopened.why,
    JSON.stringify(reopened));

  // ------------------------------------------------------------ نما
  console.log('\n— نمای کارها —');
  await page.evaluate(() => window.App.goTasks());
  await page.waitForSelector('.tasks-view');
  const view = await page.evaluate(() => ({
    hash: location.hash,
    rows: document.querySelectorAll('.task').length,
    bucketTitles: [...document.querySelectorAll('.task-bucket-head h2')]
      .map(h => h.textContent),
    navActive: (document.querySelector('.nav-btn.active') || {}).textContent,
    presets: document.querySelectorAll('.task-quick .chip-btn').length
  }));
  check('نما نشانی خودش را دارد و در نوار بالا فعال است',
    view.hash === '#/tasks' && view.navActive === 'کارها', view.hash);
  check('کارها در سطل‌های سررسید دیده می‌شوند',
    view.rows >= 3 && view.bucketTitles.length >= 2, view.bucketTitles.join(' | '));
  check('دکمه‌های ثبت سریع هست', view.presets >= 6, view.presets + ' دکمه');

  // رفرش صفحه باید همین‌جا برگردد
  await bootApp(page, APP + '#/tasks', { settle: 700 });
  check('بعد از رفرش، همین نما برمی‌گردد',
    !!(await page.$('.tasks-view')));

  const clicked = await page.evaluate(async () => {
    const before = window.Notes.tasks({ status: 'open' }).length;
    document.querySelector('.task-quick .chip-btn').click();
    await new Promise(r => setTimeout(r, 350));
    return { before: before, after: window.Notes.tasks({ status: 'open' }).length };
  });
  check('ثبت سریع با یک کلیک کار می‌سازد',
    clicked.after === clicked.before + 1, clicked.before + ' → ' + clicked.after);

  const ticked = await page.evaluate(async () => {
    const box = document.querySelector('.task .task-check');
    box.click();
    await new Promise(r => setTimeout(r, 350));
    return window.Notes.tasks({ status: 'done' }).length;
  });
  check('تیک زدن سطر، کار را می‌بندد', ticked >= 2, ticked + ' کار بسته');

  // ------------------------------------------------------ داخل پرونده
  console.log('\n— تب «کارها و یادداشت‌ها» —');
  const inCase = await page.evaluate(async () => {
    const id = window.Model.state.cases[0].id;
    window.App.state.formTab = '__notes';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 500));
    return {
      tabLabel: [...document.querySelectorAll('.tab')].map(t => t.textContent.trim())
        .find(t => t.indexOf('یادداشت') >= 0),
      hasChecklist: !!document.querySelector('.task-case-panel'),
      quickButtons: document.querySelectorAll('.task-case-panel .chip-btn').length,
      hasNoteForm: !!document.querySelector('.note-form')
    };
  });
  check('تب، نام تازه‌اش را دارد',
    /^کارها و یادداشت‌ها/.test(inCase.tabLabel || ''), inCase.tabLabel);
  check('هم چک‌لیست کار هست، هم دفتر یادداشت',
    inCase.hasChecklist && inCase.hasNoteForm && inCase.quickButtons > 0,
    inCase.quickButtons + ' دکمهٔ سریع');

  const caseTask = await page.evaluate(async () => {
    const id = window.Model.state.cases[0].id;
    const before = window.Notes.tasks({ caseId: id, status: 'open' }).length;
    document.querySelector('.task-case-panel .chip-btn').click();
    await new Promise(r => setTimeout(r, 400));
    const after = window.Notes.tasks({ caseId: id, status: 'open' });
    return { before: before, after: after.length, last: after[after.length - 1] };
  });
  check('کارِ ثبت‌شده از داخل پرونده به همان پرونده می‌چسبد',
    caseTask.after === caseTask.before + 1 && !!caseTask.last,
    caseTask.before + ' → ' + caseTask.after);

  // یادداشت‌ها نباید در فهرست کارها بیایند و برعکس
  const split = await page.evaluate(() => ({
    noteRows: document.querySelectorAll('.note-list > .note').length,
    taskRows: document.querySelectorAll('.task-case-panel .task').length
  }));
  check('یادداشت در چک‌لیست کارها نمی‌آید و کار در فهرست یادداشت‌ها',
    split.noteRows === 1 && split.taskRows >= 1, JSON.stringify(split));

  // ---------------------------------------------------------- کارتابل
  console.log('\n— کارتابل —');
  await page.evaluate(() => window.App.goWork());
  await page.waitForSelector('.worklist');
  const wl = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.wl-stat-label')].map(x => x.textContent);
    return {
      hasStat: labels.indexOf('کار امروز') >= 0,
      hasSection: !!document.querySelector('.task-section'),
      sectionRows: document.querySelectorAll('.task-section .task').length,
      labels: labels
    };
  });
  check('کارت آمار «کار امروز» در کارتابل هست', wl.hasStat, wl.labels.join(' | '));
  check('بخش «کارهای امروز» با سطرهایش می‌آید',
    wl.hasSection && wl.sectionRows > 0, wl.sectionRows + ' سطر');

  const jumped = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('.wl-stat')]
      .find(x => (x.textContent || '').indexOf('کار امروز') >= 0);
    if (!b || b.tagName !== 'BUTTON') return 'کارت دکمه نیست';
    b.click();
    await new Promise(r => setTimeout(r, 300));
    return location.hash;
  });
  check('کلیک روی کارت، به نمای کارها می‌برد', jumped === '#/tasks', jumped);

  // ------------------------------------------------------------ ماندگاری
  console.log('\n— ماندگاری —');
  const persisted = await page.evaluate(async () => {
    await window.Notes.load();
    const t = window.Notes.tasks({ status: 'open' });
    return {
      n: t.length,
      allTasks: t.every(x => x.kind === 'task' && x.status === 'open')
    };
  });
  check('کارها از انبار برمی‌گردند و شکلشان سالم است',
    persisted.n > 0 && persisted.allTasks, persisted.n + ' کار باز');

  /* رکورد قدیمی نه kind دارد نه status؛ باید همان لحظهٔ خواندن یادداشتِ
     باز شمرده شود، نه اینکه از فهرست بیفتد یا کار به‌حساب بیاید. */
  const legacy = await page.evaluate(async () => {
    const id = window.Model.state.cases[1].id;
    await window.Store.put('notes', [{
      id: 'legacy-1', caseId: id, text: 'یادداشت قدیمی بدون kind',
      done: false, at: new Date().toISOString(), atJalali: window.J.stamp()
    }]);
    await window.Notes.load();
    const n = window.Notes.forCase(id).find(x => x.id === 'legacy-1');
    return n ? { kind: n.kind, status: n.status, priority: n.priority } : null;
  });
  check('رکورد قدیمی بدون مهاجرت، یادداشتِ باز خوانده می‌شود',
    legacy && legacy.kind === 'note' && legacy.status === 'open' &&
    legacy.priority === 'normal', JSON.stringify(legacy));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
