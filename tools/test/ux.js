/*
 * تست تجربهٔ کاربری: چیزهایی که «کار می‌کنند» ولی اگر بد باشند، کاربر را
 * گمراه می‌کنند — دکمهٔ غیرفعال، رنگی که دروغ می‌گوید، یا کارتی که مثل دکمه
 * دیده می‌شود و کاری نمی‌کند.
 * اجرا:  node tools/test/ux.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');

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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(800);

  console.log('\n— وضعیت ذخیره —');
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr');
  await page.evaluate(() => window.App.openCase(window.App.state.lastResult[2].id));
  await page.waitForTimeout(500);

  const clean = await page.evaluate(() => ({
    disabled: document.querySelector('.case-save').disabled,
    chipHidden: getComputedStyle(document.querySelector('.dirty-chip')).display === 'none'
  }));
  check('تا چیزی عوض نشده، دکمهٔ ذخیره غیرفعال است',
    clean.disabled && clean.chipHidden);

  const dirty = await page.evaluate(() => {
    const i = document.querySelector('.field-grid input.input');
    i.value = i.value + ' ';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      disabled: document.querySelector('.case-save').disabled,
      chipShown: getComputedStyle(document.querySelector('.dirty-chip')).display !== 'none',
      primary: document.querySelector('.case-save').classList.contains('primary')
    };
  });
  check('با اولین تغییر، ذخیره فعال و «ذخیره‌نشده» نشان داده می‌شود',
    !dirty.disabled && dirty.chipShown && dirty.primary);

  // دکمهٔ حذف نباید هم‌مرز دکمهٔ ذخیره باشد
  const neighbours = await page.evaluate(() => {
    const save = document.querySelector('.case-save');
    const del = document.querySelector('.case-delete');
    if (!del) return { noDelete: true };
    const kids = [...save.parentNode.children].filter(
      c => getComputedStyle(c).display !== 'none');
    const si = kids.indexOf(save), di = kids.indexOf(del);
    return { adjacent: Math.abs(si - di) === 1, si: si, di: di };
  });
  check('دکمهٔ حذف کنار دکمهٔ ذخیره ننشسته است', !neighbours.adjacent,
    JSON.stringify(neighbours));

  // ریل پرونده باید هم‌راستای بقیهٔ بلوک‌های صفحه باشد، نه چسبیده به لبه
  const railAlign = await page.evaluate(() => {
    const rail = document.querySelector('.case-rail').getBoundingClientRect();
    const head = document.querySelector('.case-head').getBoundingClientRect();
    const panel = document.querySelector('.form-panel').getBoundingClientRect();
    return {
      dRight: Math.round(rail.right - head.right),
      dLeft: Math.round(rail.left - head.left),
      samePanel: Math.abs(rail.left - panel.left) < 2
    };
  });
  check('ریل گردش‌کار با بقیهٔ صفحه هم‌راستاست',
    Math.abs(railAlign.dRight) < 2 && Math.abs(railAlign.dLeft) < 2 &&
    railAlign.samePanel, JSON.stringify(railAlign));

  console.log('\n— رفتن به پروندهٔ بعدی —');
  const nav = await page.evaluate(() => {
    const before = window.App.state.caseId;
    const pos = document.querySelector('.case-nav-pos').textContent;
    window.App.setDirty(false);
    document.querySelectorAll('.case-nav-btn')[1].click();
    return { before: before, pos: pos };
  });
  await page.waitForTimeout(500);
  const navAfter = await page.evaluate(() => ({
    id: window.App.state.caseId,
    pos: document.querySelector('.case-nav-pos').textContent,
    expected: window.App.state.lastResult[3].id
  }));
  check('«پروندهٔ بعدی» همان پروندهٔ بعدیِ فهرست را باز می‌کند',
    navAfter.id === navAfter.expected && navAfter.id !== nav.before,
    nav.pos.trim() + ' ← ' + navAfter.pos.trim());

  const edges = await page.evaluate(() => {
    window.App.setDirty(false);
    window.App.openCase(window.App.state.lastResult[0].id);
    const first = [...document.querySelectorAll('.case-nav-btn')].map(b => b.disabled);
    window.App.openCase(window.App.state.lastResult[window.App.state.lastResult.length - 1].id);
    const last = [...document.querySelectorAll('.case-nav-btn')].map(b => b.disabled);
    return { first: first, last: last };
  });
  check('در ابتدا و انتهای فهرست، دکمهٔ بی‌معنا غیرفعال است',
    edges.first[0] === true && edges.first[1] === false &&
    edges.last[0] === false && edges.last[1] === true,
    JSON.stringify(edges));

  console.log('\n— کارت‌های آمار کارتابل —');
  await page.evaluate(() => { window.App.setDirty(false); window.App.goWork(); });
  await page.waitForSelector('.wl-stats');
  await page.waitForTimeout(400);
  const stats = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.wl-stat')];
    return cards.map(c => ({
      label: c.querySelector('.wl-stat-label').textContent,
      num: window.U.toLatinDigits(c.querySelector('.wl-stat-num').textContent),
      isButton: c.tagName === 'BUTTON',
      off: c.classList.contains('wl-stat-off')
    }));
  });
  // هر کارتی که عددش صفر نیست باید کلیک‌شدنی باشد، و هر کارت صفر، بی‌صدا
  check('هر کارت آمارِ ناصفر کلیک‌شدنی است',
    stats.every(s => (Number(s.num) > 0) === s.isButton),
    stats.map(s => s.label + ':' + s.num + (s.isButton ? '✔' : '✖')).join(' | '));
  check('کارت صفر، شکل دکمه ندارد',
    stats.filter(s => Number(s.num) === 0).every(s => s.off && !s.isButton));

  const statClick = await page.evaluate(() => {
    const card = [...document.querySelectorAll('button.wl-stat')]
      .find(c => c.querySelector('.wl-stat-label').textContent === 'منتظر اقدام ما');
    const expected = window.U.toLatinDigits(card.querySelector('.wl-stat-num').textContent);
    card.click();
    return { expected: Number(expected), got: window.App.state.lastResult.length,
      view: window.App.state.view, note: window.App.state.filterNote };
  });
  check('کلیک روی کارت، همان پرونده‌ها را در فهرست می‌آورد',
    statClick.view === 'list' && statClick.got === statClick.expected,
    statClick.got + ' از ' + statClick.expected + ' — ' + statClick.note);

  // ریل ریزِ پانزده‌مرحله‌ای باید به‌شکل نوار قطعه‌قطعه خوانده شود، نه نقطه‌های چسبیده
  await page.evaluate(() => { window.App.setDirty(false); window.App.goList(); });
  await page.waitForSelector('.tr .rail-mini', { timeout: 20000 });
  const miniRail = await page.evaluate(() => {
    const r = document.querySelector('.tr .rail-mini');
    if (!r) return { missing: true };
    const seg = r.children[0].querySelector('.rail-dot').getBoundingClientRect();
    return {
      steps: r.children.length,
      width: Math.round(r.getBoundingClientRect().width),
      segWidth: Math.round(seg.width * 10) / 10,
      shape: getComputedStyle(r.children[0].querySelector('.rail-dot')).borderRadius
    };
  });
  check('ریل ریز با پانزده مرحله هم خوانا می‌ماند',
    miniRail.steps === 15 && miniRail.segWidth >= 4,
    miniRail.steps + ' قطعه، هرکدام ' + miniRail.segWidth + 'px در ' + miniRail.width + 'px');

  console.log('\n— فهرست خالی —');
  await page.evaluate(() => { window.App.clearFilterNote(); });
  await page.waitForTimeout(300);
  await page.fill('.search', 'قققق');
  await page.waitForTimeout(500);
  const empty = await page.evaluate(() => {
    const box = document.querySelector('.empty-state');
    const btns = [...box.querySelectorAll('.btn')].map(b => b.textContent);
    return {
      text: box.textContent,
      primary: (box.querySelector('.btn.primary') || {}).textContent || '',
      btns: btns
    };
  });
  check('وقتی جستجو نتیجه‌ای ندارد، کار اصلی «پاک کردن جستجو» است',
    empty.primary.indexOf('پاک کردن') >= 0, empty.btns.join(' | '));
  check('پیام خالی می‌گوید از چند پرونده و با چه جستجویی',
    /قققق/.test(empty.text) && /۳۱/.test(empty.text));

  const cleared = await page.evaluate(() => {
    document.querySelector('.empty-state .btn.primary').click();
    return { q: window.App.state.q, rows: window.App.state.lastResult.length };
  });
  check('دکمه واقعاً جستجو و فیلترها را پاک می‌کند',
    cleared.q === '' && cleared.rows === 31, cleared.rows + ' پرونده');

  console.log('\n— رنگ‌ها معنا را درست می‌گویند —');
  await page.evaluate(() => window.App.goReport());
  await page.waitForSelector('.finding');
  await page.waitForTimeout(1200);
  const sev = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.finding').forEach(f => {
      const kind = [...f.classList].find(c => c.indexOf('sev-') === 0);
      const tag = f.querySelector('.sev-tag');
      out[kind] = getComputedStyle(tag).color;
    });
    return out;
  });
  const distinct = new Set(Object.values(sev));
  check('هر شدت رنگ خودش را دارد (بحرانی سبز نیست)',
    distinct.size === Object.keys(sev).length,
    Object.keys(sev).map(k => k + '=' + sev[k]).join(' | '));
  check('«بحرانی» به رنگ شنگرف است',
    (sev['sev-critical'] || '') === 'rgb(178, 58, 43)', sev['sev-critical']);

  const icons = await page.evaluate(() => ({
    svg: document.querySelectorAll('.finding-icon svg').length,
    total: document.querySelectorAll('.finding-icon').length
  }));
  check('آیکن یافته‌ها از همان خانوادهٔ خطی است، نه شکلک',
    icons.svg === icons.total && icons.total > 0,
    icons.svg + ' از ' + icons.total);

  const palette = await page.evaluate(() => ({
    series: window.Charts.C.series[0],
    ordinal: window.Charts.C.ordinal[0],
    bars: [...document.querySelectorAll('.c-bar, rect.c-seg')].slice(0, 1)
      .map(b => b.getAttribute('fill'))
  }));
  check('پالت نمودارها همان پالت اعتبارسنجی‌شدهٔ برنامه است',
    palette.series === '#4C5BC0' && palette.ordinal === '#D7B26A',
    palette.series + ' / ' + palette.ordinal);

  console.log('\n— مهلت‌ها قابل تنظیم است —');
  const before = await page.evaluate(() =>
    window.Worklist.summary(window.Model.state.cases).overdue);
  await page.evaluate(() => window.UIMisc.settingsDialog(window.App));
  await page.waitForSelector('.sla-editor');
  const slaFields = await page.evaluate(() =>
    document.querySelectorAll('.sla-input').length);
  check('مهلت همهٔ مرحله‌ها در تنظیمات قابل ویرایش است', slaFields === 15,
    slaFields + ' فیلد');

  await page.evaluate(() => {
    document.querySelectorAll('.sla-input').forEach(i => { i.value = '300'; });
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
  });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    overdue: window.Worklist.summary(window.Model.state.cases).overdue,
    sla: window.Worklist.sla().assign
  }));
  check('تغییر مهلت، شمارش دیرکرد را عوض می‌کند',
    after.sla === 300 && after.overdue < before,
    before + ' ← ' + after.overdue);

  await page.reload();
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(800);
  const persisted = await page.evaluate(() => window.Worklist.sla().assign);
  check('مهلت‌های تنظیم‌شده پس از رفرش می‌مانند', persisted === 300, String(persisted));

  // بازگرداندن به پیش‌فرض
  await page.evaluate(() => window.UIMisc.settingsDialog(window.App));
  await page.waitForSelector('.sla-editor');
  const reset = await page.evaluate(() => {
    [...document.querySelectorAll('.sla-editor .btn')]
      .find(b => b.textContent.indexOf('پیش‌فرض') >= 0).click();
    return [...document.querySelectorAll('.sla-input')].map(i => i.value);
  });
  check('دکمهٔ «بازگرداندن به پیش‌فرض» مقدارها را برمی‌گرداند',
    reset[0] === '3' && reset.join(',') !== '300,300,300,300,300,300,300,300',
    reset.join('/'));
  await page.keyboard.press('Escape');

  console.log('\n— فیلترها باز و بسته می‌شوند —');
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.filter-group');
  const caret = await page.evaluate(() => {
    const sum = document.querySelector('.filter-group summary');
    return getComputedStyle(sum, '::after').content;
  });
  check('گروه فیلترها نشانهٔ باز/بسته دارد', caret && caret !== 'none', caret);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
