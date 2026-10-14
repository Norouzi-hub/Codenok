/*
 * چک‌لیست مرحله‌ای.
 *
 * «وقتی پرونده به این مرحله رسید، این کارها باید بشود» — و هیچ‌کدام از
 * دست نرود. چهار چیز را می‌سنجیم:
 *
 *   ۱) موتور: یک بار ساخته می‌شود، نه هر بار؛ وابسته به نوع پرونده؛
 *      سه‌حالتیِ انجام‌شد/لازم‌نبود/مانده.
 *   ۲) تیکِ خودکار: فیلدی که پر شد و سندی که بارگذاری شد و فرمی که
 *      ساخته شد، تیکِ آیتمِ خودشان را می‌زنند.
 *   ۳) نما: در پرونده باز، در صفحهٔ کارها جمع‌شده (یک سطر، نه هشت).
 *   ۴) هشدار، نه سد: کارِ ماندهٔ مرحلهٔ قبل گفته می‌شود ولی جلوی
 *      هیچ‌چیز را نمی‌گیرد.
 *
 * اجرا:  node tools/test/checklist.js
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
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1050 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await bootApp(page, APP);

  // ================================================== قالب‌ها و ساخت
  console.log('\n— قالب، و ساختی که یک بار اتفاق می‌افتد —');

  const made = await page.evaluate(async () => {
    const J = window.J, M = window.Model, C = window.Checklist;
    const r = await M.create({
      caseNo: '1405970', status: 'مفتوح رسیدگی', firstName: 'سارا',
      lastName: 'احمدی', caseType: 'تنبیه', intakeDate: J.addDays(J.today(), -4)
    });
    const rec = r.record || r;
    const first = await C.ensureFor(M.get(rec.id));
    const again = await C.ensureFor(M.get(rec.id));   // دوباره نباید بسازد
    const g = C.groups(rec.id)[0];
    return {
      id: rec.id,
      stage: window.Worklist.nextAction(M.get(rec.id)).key,
      first: first, again: again,
      tplStage: C.dueTemplate(M.get(rec.id)).stage,
      titles: g.tasks.map(t => t.title),
      steps: g.tasks.map(t => t.step),
      optional: g.tasks.filter(t => t.optional).map(t => t.title),
      category: g.tasks[0].category,
      total: g.total, open: g.open, openRequired: g.openRequired, pct: g.pct
    };
  });
  check('چک‌لیستِ مرحلهٔ جاری ساخته می‌شود',
    made.first === 5 && made.tplStage === made.stage,
    made.first + ' کار، مرحلهٔ ' + made.stage);
  check('دفعهٔ دوم دوباره ساخته نمی‌شود', made.again === 0);
  check('ترتیب کارها همان ترتیب قالب است',
    made.steps.join(',') === '1,2,3,4,5' &&
    made.titles[0] === 'ثبت اطلاعات شخص' &&
    made.titles[4] === 'پوشه کردن پرونده', made.titles.join(' / '));
  check('کارِ اختیاری علامت خودش را دارد',
    made.optional.length === 1 && /رفع نواقص/.test(made.optional[0]),
    made.optional.join('، '));
  check('کارِ الزامیِ مانده جدا شمرده می‌شود',
    made.total === 5 && made.open === 5 && made.openRequired === 4,
    JSON.stringify({ total: made.total, open: made.open, req: made.openRequired }));
  check('همه در یک دستهٔ مشخص می‌نشینند',
    made.category === 'چک‌لیست مرحله', made.category);

  // =============================================== سه حالت، نه دو حالت
  console.log('\n— انجام شد / لازم نبود / مانده —');

  const states = await page.evaluate(async (id) => {
    const C = window.Checklist, N = window.Notes;
    const g = C.groups(id)[0];
    await N.complete(g.tasks[1]);                       // انجام شد
    await N.skipTask(g.tasks[3], 'نواقصی نداشت');       // لازم نبود
    const after = C.groups(id)[0];
    return {
      done: after.done, skipped: after.skipped, open: after.open,
      settled: after.settled, pct: after.pct,
      statuses: after.tasks.map(t => t.status),
      reason: after.tasks[3].cancelReason,
      /* گزارشِ صفحهٔ کارها عمداً چک‌لیست را نمی‌شمارد — آن بخشِ
         خودش را دارد. اینجا هر دو را می‌سنجیم. */
      report: N.report('14000101', window.J.today()),
      clStats: window.Checklist.stats('14000101', window.J.today())
    };
  }, made.id);
  check('هر سه حالت جدا شمرده می‌شوند',
    states.done === 1 && states.skipped === 1 && states.open === 3 &&
    states.settled === 2 && states.pct === 40, JSON.stringify(states.statuses));
  check('علتِ «لازم نبود» ثبت می‌شود', states.reason === 'نواقصی نداشت');
  check('در آمار چک‌لیست، «لازم نبود» با «انجام شد» یکی شمرده نمی‌شود',
    states.clStats.done === 1 && states.clStats.skipped === 1,
    'انجام: ' + states.clStats.done + ' / لازم نبود: ' + states.clStats.skipped);
  check('گزارشِ صفحهٔ کارها، چک‌لیست را نمی‌شمارد — بخشِ خودش را دارد',
    states.report.done === 0 && states.report.skipped === 0,
    JSON.stringify({ done: states.report.done, skipped: states.report.skipped }));

  // ===================================================== تیکِ خودکار
  console.log('\n— کاری که انجام شد، تیکش هم خودش می‌خورد —');

  const auto = await page.evaluate(async (id) => {
    const M = window.Model, C = window.Checklist;
    const before = C.groups(id)[0].tasks[0].status;
    // فیلدِ «کد ملی» پر می‌شود → آیتمِ «ثبت اطلاعات شخص» تیک می‌خورد
    await M.applyPatches([{ id: id, patch: { nationalId: '0061112223' } }],
      { kind: 'update', note: 'آزمون' });
    const n = await C.sync(M.get(id));
    const after = C.groups(id)[0].tasks[0].status;
    return { before: before, after: after, synced: n };
  }, made.id);
  check('فیلد که پر شد، آیتمِ وصل به آن تیک می‌خورد',
    auto.before === 'open' && auto.after === 'done' && auto.synced === 1,
    auto.before + ' → ' + auto.after);

  const hit = await page.evaluate(async () => {
    const J = window.J, M = window.Model, C = window.Checklist;
    const r = await M.create({
      caseNo: '1405971', status: 'مفتوح رسیدگی', caseType: 'تنبیه',
      intakeDate: J.addDays(J.today(), -40), deliveryDate: J.addDays(J.today(), -38),
      decreeDate: J.addDays(J.today(), -36),
      invitationLetterDate: J.addDays(J.today(), -30),
      defenseReceivedDate: J.addDays(J.today(), -20),
      docsCompleteDate: J.addDays(J.today(), -10)
    });
    const rec = r.record || r;
    await C.ensureFor(M.get(rec.id));
    const g0 = C.groups(rec.id)[0];
    // فرمِ «خلاصهٔ پرونده» ساخته می‌شود → آیتمش باید تیک بخورد
    window.UILetters.printForm('summary', M.get(rec.id), {});
    await new Promise(x => setTimeout(x, 500));
    const g1 = C.groups(rec.id)[0];
    const item = g1.tasks.filter(t => t.item === 'form')[0];
    return {
      id: rec.id,
      stage: window.Worklist.nextAction(M.get(rec.id)).key,
      tpl: g0.key, label: g0.label, n: g0.total,
      formStatus: item ? item.status : 'missing'
    };
  });
  check('پروندهٔ سرِ جلسه، چک‌لیستِ «دستور کار و جلسه» می‌گیرد',
    hit.tpl === 'hearing' && hit.n === 5 && hit.stage === 'hearing',
    hit.label + ' — ' + hit.n + ' کار');
  check('فرم که ساخته شد، آیتمِ فرم تیک می‌خورد',
    hit.formStatus === 'done', hit.formStatus);

  // ================================================= نما: پرونده و کارها
  console.log('\n— یک چک‌لیست، دو نما —');

  const ui = await page.evaluate(async (id) => {
    window.App.state.formTab = '__notes';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 800));
    const block = document.querySelector('.cl-block');
    return {
      block: !!block,
      groups: document.querySelectorAll('.cl-group').length,
      items: document.querySelectorAll('.cl-item').length,
      dots: document.querySelectorAll('.cl-group .cl-dot').length,
      chip: (document.querySelector('.cl-chip') || {}).textContent || '',
      // آیتم‌های چک‌لیست نباید در فهرست کارهای آزادِ همین پرونده تکرار شوند
      freeTasks: document.querySelectorAll('.task-case-panel .task-list li').length,
      ctaButtons: [...document.querySelectorAll('.cl-do')].map(b => b.textContent)
    };
  }, made.id);
  check('چک‌لیست بالای تب «کارها و یادداشت‌ها» می‌آید',
    ui.block && ui.groups === 1 && ui.items === 5,
    ui.groups + ' چک‌لیست، ' + ui.items + ' کار');
  check('نوار نقطه‌ای پیشرفت دارد', ui.dots === 5, ui.dots + ' نقطه');
  check('چیپِ پیشرفت کنار ریل هست',
    /تشکیل پرونده/.test(ui.chip) && /از ۵/.test(ui.chip), ui.chip);
  check('آیتم‌ها در فهرست کارهای آزادِ پرونده تکرار نمی‌شوند',
    ui.freeTasks === 0, ui.freeTasks + ' سطر');
  /* در پروندهٔ بالا هر دو آیتمِ دکمه‌دار بسته شده‌اند (یکی خودکار تیک
     خورد، یکی «لازم نبود») — پس دکمه‌ای نمی‌ماند، و همین درست است. */
  check('آیتمِ بسته، دیگر دکمهٔ اقدام ندارد',
    ui.ctaButtons.length === 0, ui.ctaButtons.join(' | '));

  const ctaUi = await page.evaluate(async (id) => {
    window.App.state.formTab = '__notes';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 800));
    return {
      buttons: [...document.querySelectorAll('.cl-do')].map(b => b.textContent),
      openItems: document.querySelectorAll('.cl-item.is-open').length,
      doneItems: document.querySelectorAll('.cl-item.is-done').length
    };
  }, hit.id);
  check('آیتمِ بازی که دکمهٔ اقدام دارد، دکمه‌اش را نشان می‌دهد',
    ctaUi.buttons.length === 1 && /بارگذاری نامهٔ حضور/.test(ctaUi.buttons[0]),
    ctaUi.buttons.join(' | '));
  check('و آیتمِ تیک‌خورده از آیتمِ باز جدا دیده می‌شود',
    ctaUi.doneItems === 1 && ctaUi.openItems === 4,
    ctaUi.doneItems + ' انجام‌شده، ' + ctaUi.openItems + ' باز');

  const tasksPage = await page.evaluate(async () => {
    window.App.goTasks();
    await new Promise(r => setTimeout(r, 900));
    const lines = [...document.querySelectorAll('.cl-line')];
    return {
      lines: lines.length,
      // هر چک‌لیست یک سطر است، نه هشت
      rowsInside: document.querySelectorAll('.cl-line .cl-item').length,
      visibleItems: [...document.querySelectorAll('.cl-line')]
        .filter(l => l.open).length,
      head: (document.querySelector('.b-checklist h2') || {}).textContent,
      // آیتم‌ها نباید در سطل‌های معمولی هم بیایند
      inBuckets: [...document.querySelectorAll('.task-bucket:not(.b-checklist) .task-list li')]
        .length
    };
  });
  check('در صفحهٔ کارها، هر چک‌لیست یک سطرِ جمع‌شده است',
    tasksPage.lines >= 2 && tasksPage.visibleItems === 0,
    tasksPage.lines + ' سطر، ' + tasksPage.visibleItems + ' باز');
  check('و آیتم‌ها لای کارهای آزاد پخش نمی‌شوند',
    tasksPage.inBuckets === 0, tasksPage.inBuckets + ' سطر');
  check('بخشِ چک‌لیست سربرگ خودش را دارد',
    /چک‌لیست مرحلهٔ پرونده‌ها/.test(tasksPage.head || ''), tasksPage.head);

  const expand = await page.evaluate(async () => {
    const line = document.querySelector('.cl-line');
    line.open = true;
    await new Promise(r => setTimeout(r, 300));
    const items = line.querySelectorAll('.cl-item');
    return { items: items.length, visible: items[0].offsetHeight > 0 };
  });
  check('باز که شود، کارهایش داخلش‌اند',
    expand.items > 0 && expand.visible, expand.items + ' کار');

  // از خودِ سطر معلوم است چک‌لیستِ کدام پرونده و کدام کارمند است
  const whose = await page.evaluate(() => {
    return [...document.querySelectorAll('.cl-line')].map(l => {
      const no = l.querySelector('.reg-no').textContent;
      const rec = window.Model.state.cases.find(c => window.U.toLatinDigits(c.caseNo || '') === no);
      return {
        no, who: (l.querySelector('.cl-line-who') || {}).textContent,
        want: rec ? [rec.firstName, rec.lastName].filter(Boolean).join(' ') : null,
        label: (l.querySelector('.cl-line-label') || {}).textContent
      };
    });
  });
  check('هر سطر شماره و نام کارمند و نام چک‌لیست را دارد',
    whose.length && whose.every(x => x.label && x.who === (x.want || 'بی‌نام')),
    whose.map(x => x.no + ' ' + x.who + '/' + x.want + ' — ' + x.label).join(' | '));

  // دستهٔ «چک‌لیست مرحله»: خودِ چک‌لیست‌ها، نه صفحهٔ خالی
  const onlyCl = await page.evaluate(async () => {
    window.App.state.taskCat = window.Checklist.CATEGORY;
    window.App.render();
    await new Promise(r => setTimeout(r, 500));
    const out = {
      lines: document.querySelectorAll('.cl-line').length,
      empty: !!document.querySelector('.task-buckets .empty-state'),
      loose: document.querySelectorAll('.task-bucket:not(.b-checklist) .task-list li').length
    };
    window.App.state.taskFilter = 'standalone';
    window.App.render();
    await new Promise(r => setTimeout(r, 300));
    out.standalone = document.querySelectorAll('.cl-line').length;
    window.App.state.taskCat = null;
    window.App.state.taskFilter = 'all';
    window.App.render();
    await new Promise(r => setTimeout(r, 300));
    return out;
  });
  check('دستهٔ «چک‌لیست مرحله» چک‌لیست‌ها را نشان می‌دهد، نه «کاری پیدا نشد»',
    onlyCl.lines >= 2 && !onlyCl.empty && onlyCl.loose === 0, JSON.stringify(onlyCl));
  check('«بیرون از پرونده» چک‌لیست ندارد', onlyCl.standalone === 0);

  // ==================================================== هشدار، نه سد
  console.log('\n— کارِ ماندهٔ مرحلهٔ قبل: هشدار، نه سد —');

  const warn = await page.evaluate(async (id) => {
    const M = window.Model, C = window.Checklist, J = window.J;
    /* پرونده جلو می‌رود بی‌آنکه چک‌لیست مرحلهٔ قبل تمام شده باشد. */
    await M.applyPatches([{ id: id, patch: {
      deliveryDate: J.addDays(J.today(), -3),
      decreeDate: J.addDays(J.today(), -2),
      invitationLetterDate: J.addDays(J.today(), -1),
      defenseReceivedDate: J.today(),
      docsCompleteDate: J.today()
    } }], { kind: 'update', note: 'آزمون' });
    const rec = M.get(id);
    await C.ensureFor(rec);
    const left = C.pending(M.get(id));
    window.App.state.formTab = 'case';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 800));
    const node = document.querySelector('.cl-warn');
    return {
      stage: window.Worklist.nextAction(M.get(id)).key,
      pending: left.length,
      titles: left.map(p => p.task.title),
      shown: !!node,
      text: node ? node.textContent.replace(/\s+/g, ' ') : '',
      // سد نیست: ذخیره همچنان کار می‌کند
      canSave: !!document.querySelector('.case-save')
    };
  }, made.id);
  check('کارهای ماندهٔ مرحلهٔ قبل شمرده می‌شوند',
    warn.pending === 2 && warn.stage !== 'assign',
    warn.pending + ' کار: ' + warn.titles.join('، '));
  check('بالای پرونده هشدار می‌دهد',
    warn.shown && /از مرحلهٔ قبل مانده/.test(warn.text), warn.text.slice(0, 70));
  check('ولی سد نمی‌کند — ذخیره سرِ جایش است',
    warn.canSave && /جلوی کار را نمی‌گیرد/.test(warn.text));

  // ================================================ قالب در تنظیمات
  console.log('\n— قالب‌ها قابل ویرایش‌اند —');

  const editor = await page.evaluate(async () => {
    window.UIMisc.checklistDialog(window.App);
    await new Promise(r => setTimeout(r, 600));
    const out = {
      tpls: document.querySelectorAll('.cl-ed-tpl').length,
      items: document.querySelectorAll('.cl-ed-item').length,
      stages: [...document.querySelectorAll('.cl-ed-stage')].map(e => e.textContent)
    };
    // یک کار تازه به قالب اول
    const add = [...document.querySelectorAll('.cl-ed-tpl .btn')]
      .find(b => /کار تازه/.test(b.textContent));
    add.click();
    await new Promise(r => setTimeout(r, 250));
    const input = [...document.querySelectorAll('.cl-ed-tpl')][0]
      .querySelectorAll('.cl-ed-item input[type=text]');
    const last = input[input.length - 1];
    last.value = 'گرفتن امضای کارشناس';
    last.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.modal-foot .btn')]
      .find(b => /ذخیرهٔ قالب/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 700));
    const saved = window.Checklist.templates()[0];
    return Object.assign(out, {
      savedItems: saved.items.length,
      savedLast: saved.items[saved.items.length - 1].title,
      persisted: !!(window.Model.state.settings.checklists || []).length
    });
  });
  check('هر سه قالب با مرحله‌شان دیده می‌شوند',
    editor.tpls === 3 && editor.items === 12 &&
    /ارجاع به کارشناس/.test(editor.stages[0]), editor.stages.join(' | '));
  check('کار تازه اضافه و ذخیره می‌شود',
    editor.savedItems === 6 && editor.savedLast === 'گرفتن امضای کارشناس' &&
    editor.persisted, editor.savedLast);

  const newCase = await page.evaluate(async () => {
    const J = window.J, M = window.Model, C = window.Checklist;
    const r = await M.create({
      caseNo: '1405972', status: 'مفتوح رسیدگی',
      intakeDate: J.addDays(J.today(), -2)
    });
    const rec = r.record || r;
    await C.ensureFor(M.get(rec.id));
    return C.groups(rec.id)[0].total;
  });
  check('قالبِ ویرایش‌شده، روی پروندهٔ بعدی اثر می‌گذارد',
    newCase === 6, newCase + ' کار');

  // ============================================ کارنامه و خروجی کارکرد
  console.log('\n— در گزارش‌ها هم دیده می‌شود —');

  const reports = await page.evaluate(() => {
    const J = window.J;
    const k = window.Karnameh.build(J.addDays(J.today(), -30), J.today());
    const a = window.Activity.bundle(J.addDays(J.today(), -2), J.today());
    const keys = a.actions.map(x => x.key);
    const counts = a.totals.counts;
    return {
      checklist: k.checklist && {
        done: k.checklist.done, skipped: k.checklist.skipped,
        open: k.checklist.open, rows: k.checklist.rows.length
      },
      hasActions: keys.indexOf('checklist.make') >= 0 &&
        keys.indexOf('task.skip') >= 0,
      counted: (counts['checklist.make'] || 0) > 0 &&
        (counts['task.skip'] || 0) > 0
    };
  });
  check('کارنامه، چک‌لیست‌ها را با مخرجشان می‌شمارد',
    reports.checklist && reports.checklist.rows >= 1 &&
    reports.checklist.done >= 1, JSON.stringify(reports.checklist));
  check('خروجی کارکرد، ساختِ چک‌لیست و «لازم نبود» را می‌شناسد',
    reports.hasActions && reports.counted);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
