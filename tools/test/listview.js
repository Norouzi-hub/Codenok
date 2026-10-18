/*
 * فهرست پرونده‌ها: کشوی فیلترها، ترتیب ستون‌ها و مرتب‌سازیِ ماندگار.
 *
 *   ۱) فیلترها کشویی‌اند که از کنار باز می‌شود؛ پیش‌فرض بسته است، با هر
 *      تیکِ فیلتر باز می‌ماند، و Esc یا کلیکِ بیرون می‌بندد.
 *   ۲) ترتیب ستون‌ها با کشیدن سرستون یا ↑↓ در پنجرهٔ ستون‌ها عوض می‌شود.
 *   ۳) مرتب‌سازی و ترتیب ستون‌ها بعد از رفرش و بازکردن دوباره سرِ جایشان‌اند.
 *
 * اجرا:  node tools/test/listview.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/nokman/index.html');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'], viewport: { width: 1440, height: 900 }, locale: 'fa-IR'
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(APP);
  await page.waitForSelector('.start-screen, .worklist', { timeout: 20000 });
  if (await page.$('.start-demo')) await page.evaluate(() => document.querySelector('.start-demo').click());
  await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
  await page.evaluate(async () => { window.App.goList(); await new Promise(r => setTimeout(r, 600)); });

  // ===================================================== کشوی فیلترها
  console.log('— کشوی فیلترها —');
  const closed = await page.evaluate(() => {
    const d = document.querySelector('.fdrawer');
    return {
      exists: !!d, open: d && d.classList.contains('is-open'),
      visible: d && getComputedStyle(d).visibility,
      sidebar: !!document.querySelector('aside.sidebar'),
      tableLeft: document.querySelector('.tscroll').getBoundingClientRect().left
    };
  });
  check('پیش‌فرض بسته است، و ستونِ ثابتِ کنار رفته', closed.exists && !closed.open &&
    closed.visible === 'hidden' && !closed.sidebar, JSON.stringify(closed));
  check('جدول تمامِ عرض را دارد', closed.tableLeft < 40, closed.tableLeft + 'px');

  await page.click('.filter-toggle');
  await page.waitForTimeout(450);
  const opened = await page.evaluate(() => {
    const d = document.querySelector('.fdrawer'), r = d.getBoundingClientRect();
    return { open: d.classList.contains('is-open'), left: Math.round(r.left), w: Math.round(r.width),
      expanded: document.querySelector('.filter-toggle').getAttribute('aria-expanded') };
  });
  check('دکمهٔ «فیلترها» کشو را از کنار باز می‌کند', opened.open && opened.left === 0 &&
    opened.w > 250 && opened.expanded === 'true', JSON.stringify(opened));

  // تیک یک فیلتر: فهرست از نو ساخته می‌شود، کشو باید باز بماند
  const filtered = await page.evaluate(async () => {
    const g = document.querySelector('.fdrawer .filter-group');
    g.open = true;
    const body = document.querySelector('.fdrawer-body');
    body.scrollTop = 40;
    body.dispatchEvent(new Event('scroll'));
    const before = window.App.state.lastResult.length;
    g.querySelector('.filter-option input').click();
    await new Promise(r => setTimeout(r, 400));
    const d = document.querySelector('.fdrawer');
    return { before, after: window.App.state.lastResult.length, open: d.classList.contains('is-open'),
      badge: (document.querySelector('.filter-toggle .badge') || {}).textContent,
      chips: document.querySelectorAll('.list-main > .filter-chips .fchip').length,
      scroll: document.querySelector('.fdrawer-body').scrollTop };
  });
  check('با تیکِ فیلتر، فهرست عوض می‌شود و کشو باز می‌ماند',
    filtered.after < filtered.before && filtered.open, JSON.stringify(filtered));
  check('شمارِ فیلترِ فعال روی دکمه، و چیپش بالای جدول', filtered.badge === '۱' && filtered.chips === 1);
  check('جای اسکرولِ کشو هم می‌ماند', filtered.scroll > 0, String(filtered.scroll));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const esc = await page.evaluate(() => document.querySelector('.fdrawer').classList.contains('is-open'));
  check('Esc می‌بندد', !esc);
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('f');
  await page.waitForTimeout(400);
  const fkey = await page.evaluate(() => document.querySelector('.fdrawer').classList.contains('is-open'));
  check('کلید F باز می‌کند', fkey);
  await page.evaluate(() => document.querySelector('.fdrawer-scrim').click());
  await page.waitForTimeout(400);
  const scrim = await page.evaluate(() => document.querySelector('.fdrawer').classList.contains('is-open'));
  check('کلیکِ بیرونِ کشو می‌بندد', !scrim);
  await page.evaluate(() => { window.App.state.filters = {}; window.App.refresh(true); });

  // ====================================================== کپیِ کد ملی
  console.log('\n— کپیِ کد ملی —');
  // کلیپ‌بوردِ واقعی روی file:// اجازه نمی‌خواهد ولی خواندنش را نمی‌دهد؛ ضبطش می‌کنیم
  await page.evaluate(() => {
    window.__copied = [];
    navigator.clipboard.writeText = t => { window.__copied.push(t); return Promise.resolve(); };
  });
  const rowCopy = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.trow')].find(r => r.querySelector('.td-copy .copy-btn'));
    const btn = row.querySelector('.td-copy .copy-btn');
    const shown = row.querySelector('.td-copy-text').textContent;
    btn.click();
    await new Promise(r => setTimeout(r, 200));
    return { shown, copied: window.__copied[0], view: window.App.state.view,
      done: btn.classList.contains('is-done'), toast: document.querySelector('#toast').textContent,
      title: btn.title };
  });
  check('کنار کد ملی در جدول، دکمهٔ کپی', rowCopy.title === 'کپی کد ملی', rowCopy.shown);
  check('یک کلیک: کد ملی با رقمِ لاتین و بی‌فاصله کپی می‌شود', /^\d{10}$/.test(rowCopy.copied || '') &&
    rowCopy.copied === rowCopy.shown.replace(/\D/g, ''), rowCopy.copied);
  check('و پرونده باز نمی‌شود؛ تیک و پیامِ «کپی شد»', rowCopy.view === 'list' && rowCopy.done &&
    /کد ملی کپی شد/.test(rowCopy.toast), rowCopy.toast);

  const hover = await page.evaluate(() => {
    const b = document.querySelector('.trow .td-copy .copy-btn:not(.is-done)');
    return b ? +getComputedStyle(b).opacity : null;
  });
  check('در جدول کم‌رنگ است تا شلوغ نکند', hover !== null && hover < 0.6, String(hover));

  // بی‌کلیپ‌بورد (بعضی مرورگرها روی file://): راهِ دوم
  const fallback = await page.evaluate(async () => {
    const keep = navigator.clipboard.writeText;
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    const origExec = document.execCommand.bind(document);
    let used = '';
    document.execCommand = cmd => { if (cmd === 'copy') { used = document.activeElement.value; return true; } return origExec(cmd); };
    const ok = await window.U.copy('0012345678', 'ok');
    document.execCommand = origExec;
    navigator.clipboard.writeText = keep;
    return { ok, used };
  });
  check('اگر کلیپ‌بورد اجازه ندهد، با راهِ دوم کپی می‌شود', fallback.ok && fallback.used === '0012345678');

  // کارتِ موبایل
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(async () => { window.App.render(); await new Promise(r => setTimeout(r, 500)); });
  const cardCopy = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('.case-card')].find(c => c.querySelector('.card-nid .copy-btn'));
    if (!card) return null;
    window.__copied = [];
    card.querySelector('.card-nid .copy-btn').click();
    await new Promise(r => setTimeout(r, 200));
    const r = card.getBoundingClientRect(), n = card.querySelector('.card-nid').getBoundingClientRect();
    return { copied: window.__copied[0], view: window.App.state.view,
      inside: n.left >= r.left && n.right <= r.right + 1 };
  });
  check('روی کارتِ موبایل هم، کنار نام', cardCopy && /^\d{10}$/.test(cardCopy.copied || '') &&
    cardCopy.view === 'list' && cardCopy.inside, JSON.stringify(cardCopy));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => { window.App.render(); await new Promise(r => setTimeout(r, 400)); });

  // فرمِ پرونده: کنار برچسبِ کد ملی و کد پرسنلی
  const formCopy = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => c.nationalId && c.personnelCode);
    window.App.state.formTab = 'person';
    window.App.openCase(rec.id);
    await new Promise(r => setTimeout(r, 500));
    const f = document.querySelector('[data-field="nationalId"]');
    if (!f) return null;
    const btn = f.querySelector('.field-head .copy-btn');
    window.__copied = [];
    document.body.focus();
    btn.click();
    await new Promise(r => setTimeout(r, 200));
    const res = { copied: window.__copied[0], want: window.U.toLatinDigits(rec.nationalId).replace(/\D/g, ''),
      focused: document.activeElement === f.querySelector('input'),
      pc: !!document.querySelector('[data-field="personnelCode"] .copy-btn') };
    window.App.goList();
    await new Promise(r => setTimeout(r, 400));
    return res;
  });
  check('در فرمِ پرونده، کنار برچسبِ کد ملی (و کد پرسنلی)', formCopy && formCopy.copied === formCopy.want &&
    !formCopy.focused && formCopy.pc, JSON.stringify(formCopy));

  // ====================================================== ترتیب ستون‌ها
  console.log('\n— ترتیب ستون‌ها و مرتب‌سازی —');
  const cols = await page.evaluate(async () => {
    const before = window.Model.state.columns.slice();
    // کشیدنِ «نام خانوادگی» به پیش از «شمارهٔ پرونده»
    window.UIList.moveColumn(window.App, 'lastName', 'caseNo', true);
    await new Promise(r => setTimeout(r, 400));
    const heads = [...document.querySelectorAll('.th.th-field')].map(t => t.dataset.key);
    // پنجرهٔ ستون‌ها: «کد ملی» یکی بالاتر
    const m = window.UIMisc.columnsDialog(window.App);
    const items = () => [...document.querySelectorAll('.cols-item')].map(li => li.dataset.key);
    const listBefore = items();
    const i = listBefore.indexOf('nationalId');
    document.querySelectorAll('.cols-item')[i].querySelector('.cols-mv').click();   // ↑
    const listAfter = items();
    // ستونِ تازه ته فهرست می‌آید
    const box = [...document.querySelectorAll('.col-opt')].find(l => /نام پدر/.test(l.textContent)).querySelector('input');
    box.click();
    const withNew = items();
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
    await new Promise(r => setTimeout(r, 400));
    return { before, heads, listBefore, listAfter, withNew, saved: window.Model.state.columns.slice(),
      drag: document.querySelector('.th.th-field').getAttribute('draggable') };
  });
  check('کشیدنِ سرستون، ستون را جابه‌جا می‌کند', cols.heads[0] === 'lastName' &&
    cols.heads.indexOf('caseNo') === 1 && cols.drag === 'true', cols.heads.slice(0, 3).join('،'));
  const ni = cols.listBefore.indexOf('nationalId');
  check('در پنجرهٔ ستون‌ها، ↑ یکی بالا می‌برد', cols.listAfter[ni - 1] === 'nationalId');
  check('ستونِ تازه ته فهرست می‌آید، نه به ترتیبِ فایل فیلدها',
    cols.withNew[cols.withNew.length - 1] === 'fatherName');
  check('ترتیبِ انتخابی همان‌طور ذخیره می‌شود', JSON.stringify(cols.saved) === JSON.stringify(cols.withNew));

  // مرتب‌سازی با کلیک روی سرستون
  await page.evaluate(async () => {
    const th = [...document.querySelectorAll('.th.th-field')].find(t => t.dataset.key === 'lastName');
    th.click();
    await new Promise(r => setTimeout(r, 300));
    [...document.querySelectorAll('.th.th-field')].find(t => t.dataset.key === 'lastName').click();
    await new Promise(r => setTimeout(r, 300));
  });
  const sortBefore = await page.evaluate(() => ({ key: window.App.state.sortKey, dir: window.App.state.sortDir,
    first: window.App.state.lastResult.slice(0, 3).map(r => r.id) }));
  check('کلیکِ دوباره جهت را برمی‌گرداند', sortBefore.key === 'lastName' && sortBefore.dir === 'desc',
    JSON.stringify(sortBefore));

  // ویرایشِ یک پرونده ترتیب را به هم نمی‌زند
  const afterEdit = await page.evaluate(async () => {
    const r = window.App.state.lastResult[1];
    await window.Model.update(r.id, Object.assign({}, window.Model.strip(r), { notes: 'ویرایشِ آزمون' }));
    window.App.refresh();
    await new Promise(x => setTimeout(x, 300));
    return window.App.state.lastResult.slice(0, 3).map(r => r.id);
  });
  check('ویرایشِ پرونده، جایش را در فهرست عوض نمی‌کند',
    JSON.stringify(afterEdit) === JSON.stringify(sortBefore.first));

  await page.waitForTimeout(1500);       // تا ذخیره روی انبار برسد
  await page.reload();
  await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
  await page.evaluate(async () => { window.App.goList(); await new Promise(r => setTimeout(r, 600)); });
  const reloaded = await page.evaluate(() => ({
    key: window.App.state.sortKey, dir: window.App.state.sortDir,
    cols: window.Model.state.columns.slice(),
    heads: [...document.querySelectorAll('.th.th-field')].map(t => t.dataset.key),
    sorted: (document.querySelector('.th.sorted') || {}).dataset,
    drawer: document.querySelector('.fdrawer').classList.contains('is-open')
  }));
  check('بعد از رفرش: همان مرتب‌سازی', reloaded.key === 'lastName' && reloaded.dir === 'desc',
    reloaded.key + ' ' + reloaded.dir);
  check('بعد از رفرش: همان ترتیب ستون‌ها', JSON.stringify(reloaded.cols) === JSON.stringify(cols.withNew) &&
    reloaded.heads[0] === 'lastName');
  check('و کشو دوباره بسته شروع می‌شود', !reloaded.drawer);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
