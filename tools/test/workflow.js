/*
 * تست یادداشت و پیگیری، و اقدام دسته‌ای.
 * اجرا:  node tools/test/workflow.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

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

  console.log('\n— یادداشت و پیگیری —');
  const added = await page.evaluate(async () => {
    const R = window.Report, J = window.J;
    const cs = window.Model.state.cases;
    const past = await window.Notes.add(cs[0],
      'با واحد سازمانی تماس گرفته شد؛ پاسخ استعلام تا هفتهٔ آینده.',
      R.addDays(J.today(), -4));
    const today = await window.Notes.add(cs[1], 'دعوت‌نامه پست شد.', J.today());
    const future = await window.Notes.add(cs[2], 'با پروندهٔ مرتبط با هم مطرح شود.',
      R.addDays(J.today(), 6));
    const plain = await window.Notes.add(cs[0], 'یادداشت بدون قرار پیگیری.', '');
    return {
      forCase0: window.Notes.forCase(cs[0].id).length,
      openFollowUp: !!window.Notes.openFollowUp(cs[0].id),
      dueNow: window.Notes.dueFollowUps(true).length,
      all: window.Notes.dueFollowUps(false).length,
      stats: window.Notes.stats(),
      ids: { past: past.id, today: today.id, future: future.id, plain: plain.id },
      // تازه‌ترین یادداشت بالای فهرست پرونده می‌آید
      newestFirst: window.Notes.forCase(cs[0].id)[0].id === plain.id
    };
  });
  check('یادداشت روی پرونده ثبت می‌شود',
    added.forCase0 === 2 && added.openFollowUp, added.forCase0 + ' یادداشت');
  check('فقط پیگیری‌های سررسیدشده در کارتابل می‌آیند',
    added.dueNow === 2 && added.all === 3,
    added.dueNow + ' سررسیدشده از ' + added.all);
  check('یادداشت بدون قرار، پیگیری حساب نمی‌شود',
    added.stats.openFollowUps === 3 && added.stats.total === 4,
    JSON.stringify(added.stats));
  check('تازه‌ترین یادداشت بالای فهرست است', added.newestFirst);

  const searchable = await page.evaluate(() =>
    window.Model.query({ q: 'دعوت‌نامه پست', filters: {} }).length);
  check('متن یادداشت با جستجوی سراسری پیدا می‌شود', searchable === 1,
    searchable + ' نتیجه');

  const completed = await page.evaluate(async (ids) => {
    const note = window.Notes.all().find(n => n.id === ids.past);
    await window.Notes.complete(note);
    const rec = window.Model.get(note.caseId);
    return {
      done: window.Notes.all().find(n => n.id === ids.past).done,
      dueNow: window.Notes.dueFollowUps(true).length,
      openOnCase: !!window.Notes.openFollowUp(note.caseId),
      history: window.Model.historyFor(rec.id).some(h => h.kind === 'note-done')
    };
  }, added.ids);
  check('بستن پیگیری، آن را از کارتابل برمی‌دارد',
    completed.done && completed.dueNow === 1 && !completed.openOnCase,
    completed.dueNow + ' پیگیری باقی‌مانده');
  check('انجام شدن پیگیری در تاریخچهٔ پرونده ثبت می‌شود', completed.history);

  const reopened = await page.evaluate(async (ids) => {
    const note = window.Notes.all().find(n => n.id === ids.past);
    await window.Notes.reopen(note);
    return window.Notes.dueFollowUps(true).length;
  }, added.ids);
  check('پیگیری بسته‌شده دوباره باز می‌شود', reopened === 2, reopened + ' پیگیری');

  console.log('\n— پیگیری در کارتابل و صفحهٔ پرونده —');
  await page.evaluate(() => window.App.goWork());
  await page.waitForSelector('.worklist');
  // پیگیری‌ها حالا کارت‌اند، نه سطرِ جدول
  const inWork = await page.evaluate(() => ({
    rows: document.querySelectorAll('.follow-card').length,
    late: document.querySelectorAll('.follow-card.u-late').length,
    stat: [...document.querySelectorAll('.wl-stat')].some(
      s => s.textContent.indexOf('پیگیری باز') >= 0),
    hasText: [...document.querySelectorAll('.follow-note')]
      .some(n => n.textContent.trim().length > 0),
    hasDone: [...document.querySelectorAll('.follow-foot .btn')]
      .some(b => b.textContent === 'انجام شد')
  }));
  check('متن یادداشت و دکمهٔ «انجام شد» روی کارت هست',
    inWork.hasText && inWork.hasDone,
    inWork.rows + ' کارت');
  check('پیگیری‌ها در کارتابل دیده می‌شوند',
    inWork.rows === 2 && inWork.late === 1 && inWork.stat,
    inWork.rows + ' سطر، ' + inWork.late + ' دیرکرد');

  const onCase = await page.evaluate((ids) => {
    const note = window.Notes.all().find(n => n.id === ids.past);
    window.App.state.formTab = '__notes';
    window.App.openCase(note.caseId);
    return {
      banner: !!document.querySelector('.case-next.follow'),
      notes: document.querySelectorAll('.note').length,
      tabBadge: [...document.querySelectorAll('.tab')].some(
        t => t.textContent.indexOf('یادداشت') === 0 && t.querySelector('.badge'))
    };
  }, added.ids);
  check('پیگیری باز بالای پرونده نشان داده می‌شود', onCase.banner);
  check('تب یادداشت، یادداشت‌ها و شمارنده را دارد',
    onCase.notes === 2 && onCase.tabBadge, onCase.notes + ' یادداشت');

  console.log('\n— اقدام دسته‌ای —');
  const preview = await page.evaluate(() => {
    const cases = window.Model.state.cases;
    const withDate = cases.filter(c => c.committeeDate).slice(0, 3);
    const without = cases.filter(c => !c.committeeDate).slice(0, 5);
    const picked = withDate.concat(without);
    const ids = picked.map(c => c.id);
    const target = withDate.length ? withDate[0].committeeDate : '14050101';
    // انتظار را از خود داده‌ها می‌گیریم: هر پرونده‌ای که همین تاریخ را دارد «بدون تغییر» است
    const already = picked.filter(c => (c.committeeDate || '') === target).length;
    return {
      ids: ids,
      target: target,
      pv: window.Model.previewBulk(ids, { committeeDate: target }),
      expectAlready: already,
      expectChange: picked.length - already,
      total: picked.length
    };
  });
  check('پیش‌نمایش، پرونده‌های بدون تغییر را جدا می‌شمارد',
    preview.pv.willChange === preview.expectChange &&
    preview.pv.already === preview.expectAlready &&
    preview.pv.total === preview.total,
    preview.pv.willChange + ' تغییر، ' + preview.pv.already + ' بدون تغییر'
    + ' (انتظار ' + preview.expectChange + '/' + preview.expectAlready + ')');

  const applied = await page.evaluate(async (p) => {
    const before = p.ids.map(id => window.Model.get(id).committeeDate || '');
    const res = await window.Model.bulkUpdate(p.ids,
      { committeeDate: p.target, session: '۲۱' }, 'تست دسته‌ای');
    const after = p.ids.map(id => window.Model.get(id).committeeDate || '');
    const sessions = p.ids.map(id => window.Model.get(id).session || '');
    const sample = window.Model.get(p.ids[p.ids.length - 1]);
    return {
      res: res,
      allSet: after.every(d => d === p.target),
      allSessions: sessions.every(s => s === '۲۱'),
      changedCount: before.filter((b, i) => b !== after[i]).length,
      historyKind: window.Model.historyFor(sample.id).slice(-1)[0].kind,
      historyChanges: window.Model.historyFor(sample.id).slice(-1)[0].changes.length
    };
  }, preview);
  check('اقدام دسته‌ای روی همهٔ پرونده‌ها اعمال می‌شود',
    applied.allSet && applied.allSessions,
    applied.res.changed + ' پرونده تغییر کرد');
  check('پرونده‌های بدون تغییر دوباره نوشته نمی‌شوند',
    applied.res.changed + applied.res.unchanged === applied.res.total,
    JSON.stringify(applied.res));
  check('هر پرونده تغییر خودش را در تاریخچه می‌گیرد',
    applied.historyKind === 'bulk' && applied.historyChanges === 2,
    applied.historyKind + '، ' + applied.historyChanges + ' تغییر');

  console.log('\n— انتخاب در فهرست —');
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr');
  await page.evaluate(() => {
    const ids = window.App.state.lastResult.slice(0, 4).map(r => r.id);
    ids.forEach(id => window.App.toggleSelect(id, true));
    window.App.render();
  });
  // سطرها با setTimeout کشیده می‌شوند؛ باید منتظر رسم بمانیم
  await page.waitForSelector('.tr.picked', { timeout: 20000 });
  const selection = await page.evaluate(() => {
    return {
      selected: window.App.selectedIds().length,
      barOn: document.querySelector('.sel-bar').classList.contains('on'),
      picked: document.querySelectorAll('.tr.picked').length,
      boxes: document.querySelectorAll('.td-pick input').length
    };
  });
  check('انتخاب سطرها نوار اقدام را می‌آورد',
    selection.selected === 4 && selection.barOn && selection.picked > 0,
    selection.selected + ' انتخاب، ' + selection.picked + ' سطر نشان‌دار');
  check('هر سطر جعبهٔ انتخاب دارد', selection.boxes > 0, selection.boxes + ' جعبه');

  // پاک کردن ناخواسته نباید ممکن باشد: مقدار خالی یعنی «هنوز وارد نشده»
  const guard = await page.evaluate(() => {
    window.UIBulk.dialog(window.App, window.App.selectedIds(), 'تست');
    const apply = [...document.querySelectorAll('.modal-foot .btn')].pop();
    const out = {
      disabledWhenEmpty: apply.disabled,
      hasClearToggle: !!document.querySelector('.bulk-clear'),
      hint: (document.querySelector('.bulk-summary') || {}).textContent || ''
    };
    document.querySelector('.modal-head .icon-btn').click();
    return out;
  });
  check('مقدار خالی، «پاک کردن» تعبیر نمی‌شود',
    guard.disabledWhenEmpty && guard.hasClearToggle,
    guard.hint.trim());

  console.log('\n— ماندگاری —');
  await page.reload();
  await openList(page);
  const persisted = await page.evaluate(() => ({
    notes: window.Notes.all().length,
    open: window.Notes.stats().openFollowUps,
    selectionCleared: window.App.selectedIds().length
  }));
  check('یادداشت‌ها پس از رفرش باقی می‌مانند',
    persisted.notes === 4 && persisted.open === 3,
    persisted.notes + ' یادداشت، ' + persisted.open + ' پیگیری باز');
  check('انتخاب با رفرش پاک می‌شود', persisted.selectionCleared === 0);

  console.log('\n— رمزنگاری یادداشت‌ها —');
  const encrypted = await page.evaluate(async () => {
    await window.Store.setPassword('Note@12345');
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('parvandeha');
      req.onsuccess = () => {
        const db = req.result;
        const all = db.transaction(['notes'], 'readonly').objectStore('notes').getAll();
        all.onsuccess = () => {
          const rows = all.result || [];
          db.close();
          resolve({
            count: rows.length,
            sealed: rows.filter(r => !!r.__enc).length,
            blob: JSON.stringify(rows)
          });
        };
        all.onerror = () => reject(all.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  check('یادداشت‌ها هم رمزنگاری می‌شوند',
    encrypted.sealed === encrypted.count && encrypted.count === 4 &&
    encrypted.blob.indexOf('دعوت‌نامه') < 0,
    encrypted.sealed + ' از ' + encrypted.count);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
