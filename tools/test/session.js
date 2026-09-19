/*
 * تست صورت‌جلسه (ثبت نتیجهٔ جلسه از روی دستور کار) و نوار «این هفته».
 * اجرا:  node tools/test/session.js
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

/** دادهٔ واقع‌نما می‌سازد: چند پروندهٔ آمادهٔ طرح، چند مهلت در هفتهٔ پیشِ رو */
async function seedScenario(page) {
  return page.evaluate(async () => {
    const J = window.J, M = window.Model, WL = window.Worklist;
    // ترتیب state.cases از انبار می‌آید و بین اجراها یکسان نیست؛ برای اینکه
    // آزمون قطعی بماند، خودمان بر پایهٔ شمارهٔ پرونده مرتب می‌کنیم
    const open = M.state.cases.filter(c => !WL.isClosed(c))
      .slice().sort((a, b) => (a.caseNo || '') < (b.caseNo || '') ? -1 : 1);

    // چهار پرونده که ارجاع و دعوت‌نامه‌شان رفته و استعلامی معطل ندارند → آمادهٔ طرح
    const ready = open.slice(0, 4);
    for (const c of ready) {
      await M.update(c.id, Object.assign({}, c, {
        deliveryDate: c.deliveryDate || J.addDays(J.today(), -20),
        decreeDate: J.addDays(J.today(), -18),
        invitationLetterDate: J.addDays(J.today(), -12),
        defenseReceivedDate: J.addDays(J.today(), -6),
        docsCompleteDate: J.addDays(J.today(), -4),
        committeeDate: '', securityOutLetterDate: '', securityInLetterDate: ''
      }));
    }
    // سه پرونده که تازه ارجاع شده‌اند → مهلت «دعوت به جلسه» در روزهای آینده
    const soon = open.slice(6, 9);
    for (let i = 0; i < soon.length; i++) {
      await M.update(soon[i].id, Object.assign({}, soon[i], {
        // مهلت «بارگذاری آخرین حکم» پنج روز است → سررسید در روزهای آینده
        deliveryDate: J.addDays(J.today(), -3 + i),
        decreeDate: '', invitationLetterDate: '', committeeDate: '',
        securityOutLetterDate: '', securityInLetterDate: ''
      }));
    }
    window.App.render();
    return {
      ready: WL.readyForCommittee(M.state.cases).map(c => c.id),
      soon: soon.map(c => c.id)
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP, { settle: 700 });
  await page.evaluate(() => { window.print = () => {}; });

  const scenario = await seedScenario(page);
  await page.waitForTimeout(500);
  check('سناریوی آزمون ساخته شد', scenario.ready.length === 4, scenario.ready.length + ' آمادهٔ طرح');

  console.log('\n— نوار «این هفته» —');
  const week = await page.evaluate(() => {
    const W = window.Worklist.week(window.Model.state.cases, 7);
    return {
      slots: W.length,
      today: W[0].offset === 0,
      counts: W.map(s => s.count),
      total: W.reduce((n, s) => n + s.count, 0),
      // سررسید هر پرونده باید دقیقاً «از کِی منتظر است + مهلتش» باشد
      dueMatches: window.Model.state.cases.every(c => {
        const a = window.Worklist.nextAction(c);
        if (!a.due) return true;
        return a.due === window.J.addDays(a.since, a.limit);
      }),
      // آنچه از مهلت گذشته، در هفتهٔ پیشِ رو نمی‌آید
      noOverdue: W.every(s => s.deadlines.every(d => !d.action.overdue))
    };
  });
  check('هفت روز آینده ساخته می‌شود و از امروز شروع می‌شود',
    week.slots === 7 && week.today);
  check('سررسید هر اقدام = تاریخ شروع + مهلت', week.dueMatches);
  check('مهلت‌های آینده در روز خودشان می‌نشینند', week.total >= 3,
    week.counts.join('/'));
  check('دیرکردها در نوار هفته نمی‌آیند', week.noOverdue);

  const strip = await page.evaluate(() => ({
    days: document.querySelectorAll('.week-day').length,
    today: document.querySelectorAll('.week-day.today').length,
    clickable: document.querySelectorAll('button.week-day').length,
    counts: [...document.querySelectorAll('.week-count')].map(n => n.textContent)
  }));
  check('نوار هفته با هفت خانه رندر می‌شود و امروز نشان‌دار است',
    strip.days === 7 && strip.today === 1, strip.days + ' خانه');
  check('فقط روزهای پُر قابل کلیک‌اند',
    strip.clickable > 0 && strip.clickable === strip.counts.length,
    strip.clickable + ' روز');

  // قرار پیگیری دستی هم باید در همان روز دیده شود
  const withFollow = await page.evaluate(async () => {
    const J = window.J;
    const rec = window.Model.state.cases[0];
    await window.Notes.add(rec, 'تماس با واحد سازمانی.', J.addDays(J.today(), 2));
    window.App.render();
    const W = window.Worklist.week(window.Model.state.cases, 7);
    return {
      follows: W[2].follows.length,
      dot: document.querySelectorAll('.week-follow').length
    };
  });
  await page.waitForTimeout(300);
  check('قرار پیگیری دستی هم در روز خودش می‌آید',
    withFollow.follows === 1 && withFollow.dot === 1);

  // کلیک روی یک روز، همان پرونده‌ها را در فهرست می‌آورد
  const clicked = await page.evaluate(() => {
    const W = window.Worklist.week(window.Model.state.cases, 7);
    const i = W.findIndex(s => s.count > 0);
    const expected = W[i].ids.length;
    [...document.querySelectorAll('button.week-day')]
      .find(b => b.querySelector('.week-count'))
      .click();
    return { expected: expected, got: window.App.state.lastResult.length,
      view: window.App.state.view, note: window.App.state.filterNote };
  });
  check('کلیک روی یک روز، پرونده‌های همان روز را نشان می‌دهد',
    clicked.view === 'list' && clicked.got === clicked.expected,
    clicked.got + ' از ' + clicked.expected + ' — ' + clicked.note);

  console.log('\n— صورت‌جلسه —');
  await page.evaluate(() => { window.App.clearFilterNote(); window.App.goWork(); });
  await page.waitForSelector('.wl-hero-actions');
  const openable = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.wl-hero-actions .btn')];
    return { labels: btns.map(b => b.textContent), count: btns.length };
  });
  check('ثبت نتیجهٔ جلسه از سربرگ کارتابل در دسترس است',
    openable.labels.some(t => t.indexOf('ثبت نتیجه') >= 0), openable.labels.join(' | '));

  await page.evaluate(() => {
    [...document.querySelectorAll('.wl-hero-actions .btn')]
      .find(b => b.textContent.indexOf('ثبت نتیجه') >= 0).click();
  });
  await page.waitForSelector('.minutes');
  await page.waitForTimeout(400);

  const opened = await page.evaluate(() => ({
    rows: document.querySelectorAll('.minutes-row').length,
    allVerdict: [...document.querySelectorAll('.minutes-outcome')]
      .every(s => s.value === 'verdict'),
    applyDisabled: [...document.querySelectorAll('.modal-foot .btn')].pop().disabled,
    dateFilled: !!document.querySelector('.minutes-head .date-input').value
  }));
  check('پرونده‌های دستور کار خودشان در صورت‌جلسه می‌آیند',
    opened.rows === 4, opened.rows + ' سطر');
  check('تاریخ جلسه از پیش امروز است', opened.dateFilled);
  check('تا شمارهٔ جلسه وارد نشود، ثبت غیرفعال است', opened.applyDisabled);

  // یک پرونده هم که در دستور کار نبود، با جستجو اضافه می‌شود
  const added = await page.evaluate(async () => {
    const shown = [...document.querySelectorAll('.minutes-row .reg-no')]
      .map(n => n.textContent);
    // شماره‌های دارای «/» در جستجو چند نتیجه می‌دهند؛ یکی ساده برمی‌داریم
    const extra = window.Model.state.cases.find(
      c => !window.Worklist.isClosed(c) && !!c.caseNo &&
        c.caseNo.indexOf('/') < 0 &&
        !shown.includes(window.U.toLatinDigits(c.caseNo)));
    const input = document.querySelector('.minutes-add input');
    input.value = window.U.toLatinDigits(extra.caseNo);
    input.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 400));
    const hit = document.querySelector('.minutes-add-results .btn');
    if (hit) hit.click();
    return { caseNo: extra.caseNo, rows: document.querySelectorAll('.minutes-row').length };
  });
  check('پروندهٔ خارج از دستور کار هم اضافه می‌شود', added.rows === 5,
    added.rows + ' سطر');

  // نتیجه‌ها: یکی رأی، یکی بدون رأی، یکی موکول، یکی مطرح‌نشده، یکی برداشته‌شده
  const plan = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.minutes-row')];
    const ids = rows.map(r => r.querySelector('.reg-no').textContent);
    const set = (i, v) => {
      const s = rows[i].querySelector('.minutes-outcome');
      s.value = v;
      s.dispatchEvent(new Event('change'));
    };
    set(3, 'postponed');
    set(4, 'absent');
    // سطر ۱ بدون رأی می‌ماند
    const fresh = [...document.querySelectorAll('.minutes-row')];
    const s1 = fresh[1].querySelector('.minutes-outcome');
    s1.value = 'discussed';
    s1.dispatchEvent(new Event('change'));

    const again = [...document.querySelectorAll('.minutes-row')];
    const vt = again[0].querySelector('.minutes-verdict');
    vt.value = 'توبیخ کتبی با درج در پرونده.';
    vt.dispatchEvent(new Event('input'));

    document.querySelector('.minutes-head input.reg-input').value = '۲۱';
    document.querySelector('.minutes-head input.reg-input')
      .dispatchEvent(new Event('input'));
    return {
      caseNos: ids,
      summary: document.querySelector('.minutes-summary').textContent,
      applyDisabled: [...document.querySelectorAll('.modal-foot .btn')].pop().disabled
    };
  });
  check('با وارد شدن شمارهٔ جلسه، ثبت فعال می‌شود', !plan.applyDisabled);
  check('خلاصه، تفکیک نتیجه‌ها را می‌گوید',
    /۲ رأی/.test(plan.summary) && /۱ موکول/.test(plan.summary) &&
    /۱ مطرح‌نشده/.test(plan.summary), plan.summary.trim());

  // برگهٔ چاپی صورت‌جلسه
  const printed = await page.evaluate(() => {
    [...document.querySelectorAll('.modal-foot .btn')]
      .find(b => b.textContent.indexOf('چاپ') >= 0).click();
    return {
      rows: document.querySelectorAll('#print-area .p-list tr').length,
      head: (document.querySelector('#print-area .p-sub') || {}).textContent || '',
      hasOutcome: document.querySelector('#print-area .p-list tr:nth-child(2)')
        .textContent.indexOf('رأی صادر شد') >= 0
    };
  });
  check('برگهٔ چاپی صورت‌جلسه ساخته می‌شود',
    printed.rows === 6 && printed.hasOutcome, printed.rows + ' سطر — ' + printed.head.trim());

  // ثبت
  const before = await page.evaluate((nos) => {
    const find = no => window.Model.state.cases.find(
      c => window.U.toLatinDigits(c.caseNo || '') === no);
    return nos.map(no => {
      const c = find(no);
      return { no: no, committeeDate: c.committeeDate || '', session: c.session || '',
        status: c.status || '', verdict: c.verdictFull || '' };
    });
  }, plan.caseNos);

  await page.evaluate(() => {
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
  });
  await page.waitForSelector('.btn.danger');
  await page.waitForTimeout(300);
  const confirmText = await page.$eval('.overlay:last-of-type .modal-body', n => n.textContent);
  check('پیش از ثبت، صریح می‌گوید چه چیزی کجا می‌نشیند',
    confirmText.indexOf('۲ پرونده با رأی') >= 0 &&
    confirmText.indexOf('موکول') >= 0, confirmText.trim().slice(0, 90) + '…');
  await page.click('.btn.danger');
  await page.waitForTimeout(900);

  const after = await page.evaluate((nos) => {
    const find = no => window.Model.state.cases.find(
      c => window.U.toLatinDigits(c.caseNo || '') === no);
    const out = nos.map(no => {
      const c = find(no);
      const h = window.Model.historyFor(c.id);
      const last = h[h.length - 1];
      return {
        no: no,
        committeeDate: c.committeeDate || '', session: c.session || '',
        status: c.status || '', verdict: c.verdictFull || '',
        lastKind: last ? last.kind : '', lastNote: last ? last.note : '',
        notes: window.Notes.forCase(c.id).length
      };
    });
    return { rows: out, open: !!document.querySelector('.minutes') };
  }, plan.caseNos);

  const [r0, r1, r2, r3, r4] = after.rows;
  const today = await page.evaluate(() => window.J.today());

  check('پنجره پس از ثبت بسته می‌شود', !after.open);
  check('پروندهٔ «رأی صادر شد»: تاریخ، جلسه، وضعیت و متن رأی می‌نشیند',
    r0.committeeDate === today && r0.session === '۲۱' &&
    r0.status.indexOf('رای صادر') === 0 && r0.verdict.indexOf('توبیخ') === 0,
    JSON.stringify({ d: r0.committeeDate, s: r0.session, v: !!r0.verdict }));
  check('پروندهٔ «مطرح شد، رأی بعداً»: تاریخ می‌نشیند ولی رأی نه',
    r1.committeeDate === today && r1.session === '۲۱' && !r1.verdict &&
    r1.status === 'در دستور کار قرار گرفت', r1.status);
  check('پروندهٔ سوم هم رأی گرفت', r2.committeeDate === today && r2.session === '۲۱');
  check('پروندهٔ موکول‌شده هیچ تاریخی نمی‌گیرد',
    r3.committeeDate === before[3].committeeDate && r3.session === before[3].session,
    'تاریخ: «' + r3.committeeDate + '»');
  check('پروندهٔ موکول‌شده به‌جایش یادداشت می‌گیرد', r3.notes === 1);
  check('پروندهٔ مطرح‌نشده دست‌نخورده می‌ماند',
    r4.committeeDate === before[4].committeeDate &&
    r4.session === before[4].session && r4.status === before[4].status);
  check('هر پرونده رویداد «صورت‌جلسه» را در تاریخچهٔ خودش می‌گیرد',
    r0.lastKind === 'session' && /صورت‌جلسهٔ ۲۱/.test(r0.lastNote),
    r0.lastKind + ' — ' + r0.lastNote);

  // پرونده‌های رأی‌گرفته دیگر نباید در «آمادهٔ طرح» بمانند
  const afterReady = await page.evaluate(() => ({
    ready: window.Worklist.readyForCommittee(window.Model.state.cases).length,
    verdictBucket: window.Worklist.buckets(window.Model.state.cases)
      .filter(b => b.key === 'verdictText').map(b => b.items.length)[0] || 0
  }));
  check('پرونده‌های مطرح‌شده از دستور کار بیرون می‌روند و به مرحلهٔ بعد می‌روند',
    afterReady.ready <= 2, afterReady.ready + ' آمادهٔ طرح، ' +
    afterReady.verdictBucket + ' منتظر متن رأی');

  console.log('\n— ماندگاری —');
  await page.reload();
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(800);
  const persisted = await page.evaluate((no) => {
    const c = window.Model.state.cases.find(
      x => window.U.toLatinDigits(x.caseNo || '') === no);
    const h = window.Model.historyFor(c.id).filter(e => e.kind === 'session');
    return { session: c.session, verdict: !!c.verdictFull, events: h.length,
      notes: window.Notes.all().length };
  }, plan.caseNos[0]);
  check('صورت‌جلسه پس از رفرش باقی می‌ماند',
    persisted.session === '۲۱' && persisted.verdict && persisted.events === 1,
    JSON.stringify(persisted));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
