/*
 * تست موبایل: چیدمان واکنش‌گرا، کارت‌ها، نوار پایین و کارهای روزمره روی لمس.
 * اجرا:  node tools/test/mobile.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const PHONE = { width: 390, height: 780 };

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/** هیچ صفحه‌ای نباید افقی اسکرول بخورد؛ نشانهٔ روشن خراب بودن چیدمان است */
function overflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { sw: d.scrollWidth, cw: d.clientWidth, over: d.scrollWidth > d.clientWidth + 1 };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(700);

  console.log('\n— پوستهٔ موبایل —');
  const shell = await page.evaluate(() => {
    const vis = s => {
      const n = document.querySelector(s);
      return !!n && getComputedStyle(n).display !== 'none';
    };
    return {
      phone: window.Mobile.isPhone(),
      tabbar: vis('.tabbar'),
      more: vis('.more-btn'),
      desktopNav: vis('.main-nav'),
      desktopActions: vis('.top-actions'),
      search: vis('.search'),
      tabs: document.querySelectorAll('.tab-btn').length,
      searchFont: parseFloat(getComputedStyle(document.querySelector('.search')).fontSize)
    };
  });
  check('برنامه خودش را گوشی می‌شناسد', shell.phone);
  check('نوار پایین به‌جای نوار بالا می‌آید',
    shell.tabbar && shell.more && !shell.desktopNav && !shell.desktopActions,
    shell.tabs + ' مقصد');
  check('جعبهٔ جستجو همیشه در دسترس است', shell.search);
  // iOS زیر ۱۶ پیکسل هنگام تایپ صفحه را زوم می‌کند
  check('قلم ورودی‌ها زوم iOS را راه نمی‌اندازد', shell.searchFont >= 16,
    shell.searchFont + 'px');

  console.log('\n— بدون اسکرول افقی —');
  const views = [
    ['کارتابل', () => window.App.goWork(), '.worklist'],
    ['فهرست', () => window.App.goList(), '.case-card'],
    ['پرونده', () => window.App.openCase(window.Model.state.cases[0].id), '.case-view'],
    ['اشخاص', () => window.App.goPeople(), '.person-grid'],
    ['گزارش‌ها', () => window.App.goReport(), '.chart-card']
  ];
  for (const [label, go, sel] of views) {
    await page.evaluate(go);
    await page.waitForSelector(sel, { timeout: 20000 });
    await page.waitForTimeout(350);
    const o = await overflow(page);
    check(label + ' در عرض صفحه جا می‌شود', !o.over, o.sw + 'px از ' + o.cw + 'px');
  }

  console.log('\n— فهرست، کارت به‌جای جدول —');
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.case-card');
  const cards = await page.evaluate(() => ({
    cards: document.querySelectorAll('.case-card').length,
    table: document.querySelectorAll('.tr').length,
    sidebar: document.querySelectorAll('.sidebar').length,
    total: window.App.state.lastResult.length,
    hasNo: !!document.querySelector('.case-card .reg-no'),
    hasRail: !!document.querySelector('.case-card .rail-mini'),
    hasPick: !!document.querySelector('.case-card .card-pick')
  }));
  check('به‌جای سطرهای جدول، کارت رندر می‌شود',
    cards.cards > 0 && cards.table === 0 && cards.sidebar === 0,
    cards.cards + ' کارت');
  // رندر مجازی: همهٔ ۳۱ پرونده نباید هم‌زمان در DOM باشند
  check('رندر مجازی روی گوشی هم کار می‌کند', cards.cards < cards.total,
    cards.cards + ' از ' + cards.total);
  check('کارت شماره، ریل و جعبهٔ انتخاب دارد',
    cards.hasNo && cards.hasRail && cards.hasPick);

  // اشتباه کلاسیک چیدمان ستونی: فهرست از قاب بیرون می‌زند و اصلاً اسکرول نمی‌شود
  const scrolling = await page.evaluate(async () => {
    const sc = document.querySelector('.cards-scroll');
    const firstBefore = document.querySelector('.case-card .reg-no').textContent;
    sc.scrollTop = sc.scrollHeight;
    await new Promise(r => setTimeout(r, 300));
    return {
      client: sc.clientHeight,
      scroll: sc.scrollHeight,
      insideViewport: sc.getBoundingClientRect().bottom <= window.innerHeight + 1,
      moved: document.querySelector('.case-card .reg-no').textContent !== firstBefore,
      atEnd: sc.scrollTop > 0
    };
  });
  check('فهرست داخل قاب صفحه اسکرول می‌شود، نه بیرونش',
    scrolling.scroll > scrolling.client && scrolling.insideViewport,
    scrolling.client + 'px از ' + scrolling.scroll + 'px');
  check('اسکرول، پرونده‌های بعدی را می‌آورد', scrolling.atEnd && scrolling.moved);

  console.log('\n— جستجو و فیلتر —');
  await page.fill('.search', 'نوروزی');
  await page.waitForTimeout(400);
  const searched = await page.evaluate(() => ({
    rows: window.App.state.lastResult.length,
    cards: document.querySelectorAll('.case-card').length
  }));
  check('جستجو روی گوشی هم بدون رفرش کار می‌کند',
    searched.rows > 0 && searched.cards > 0, searched.rows + ' نتیجه');
  await page.fill('.search', '');
  await page.waitForTimeout(400);

  await page.click('.result-bar.mobile .btn.small.ghost');
  await page.waitForSelector('.filter-modal');
  await page.waitForTimeout(300);   // انیمیشن بالا آمدن شیت
  const filterSheet = await page.evaluate(() => ({
    groups: document.querySelectorAll('.filter-modal .filter-group').length,
    fromBottom: document.querySelector('.filter-modal').getBoundingClientRect().bottom
  }));
  check('فیلترها در شیت پایین باز می‌شوند',
    filterSheet.groups > 0 && Math.abs(filterSheet.fromBottom - 780) < 2,
    filterSheet.groups + ' گروه');
  await page.keyboard.press('Escape');

  console.log('\n— انتخاب و اقدام دسته‌ای با لمس —');
  await page.waitForSelector('.case-card');
  await page.evaluate(() => {
    const boxes = document.querySelectorAll('.case-card .card-pick');
    for (let i = 0; i < 3; i++) { boxes[i].click(); }
  });
  await page.waitForTimeout(300);
  const sel = await page.evaluate(() => {
    const bar = document.querySelector('.sel-bar');
    const r = bar.getBoundingClientRect();
    const tab = document.querySelector('.tabbar').getBoundingClientRect();
    return {
      count: window.App.selectedIds().length,
      on: bar.classList.contains('on'),
      aboveTabs: r.bottom <= tab.top + 1,
      picked: document.querySelectorAll('.case-card.picked').length
    };
  });
  check('انتخاب با لمس جعبهٔ کارت انجام می‌شود',
    sel.count === 3 && sel.picked === 3, sel.count + ' انتخاب');
  check('نوار اقدام بالای نوار پایین می‌نشیند و رویش نمی‌افتد',
    sel.on && sel.aboveTabs);

  await page.evaluate(() =>
    window.UIBulk.dialog(window.App, window.App.selectedIds(), 'تست موبایل'));
  await page.waitForSelector('.bulk-dialog');
  await page.waitForTimeout(300);
  const bulk = await page.evaluate(() => {
    const row = document.querySelector('.bulk-row');
    const field = row.querySelector('select');
    const value = row.querySelector('.bulk-value');
    return {
      // فیلد و مقدار باید در دو سطر باشند، وگرنه جعبهٔ تاریخ به یک وجب می‌رسد
      stacked: value.getBoundingClientRect().top > field.getBoundingClientRect().bottom - 2,
      valueWidth: value.getBoundingClientRect().width,
      modalGap: window.innerHeight -
        document.querySelector('.modal').getBoundingClientRect().bottom
    };
  });
  check('در اقدام دسته‌ای، مقدار زیر فیلد می‌آید', bulk.stacked);
  check('جعبهٔ مقدار جای کافی دارد', bulk.valueWidth > 180,
    Math.round(bulk.valueWidth) + 'px');
  check('پنجره‌ها روی گوشی از پایین باز می‌شوند',
    Math.abs(bulk.modalGap) < 2, Math.round(bulk.modalGap) + 'px تا کف');
  await page.keyboard.press('Escape');

  console.log('\n— یادداشت روی گوشی —');
  await page.evaluate(() => {
    window.App.state.formTab = '__notes';
    window.App.openCase(window.Model.state.cases[1].id);
  });
  await page.waitForSelector('.note-input');
  await page.fill('.note-input', 'با واحد سازمانی تماس گرفته شد.');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.note-form-row .btn.ghost')];
    btns.find(b => b.textContent.indexOf('یک هفته') >= 0).click();
  });
  await page.evaluate(() =>
    document.querySelector('.note-form-row .btn.primary').click());
  await page.waitForTimeout(500);
  const note = await page.evaluate(() => ({
    count: window.Notes.all().length,
    followUp: !!window.Notes.all()[0].followUp,
    rendered: document.querySelectorAll('.note').length
  }));
  check('یادداشت با میان‌بر تاریخ روی گوشی ثبت می‌شود',
    note.count === 1 && note.followUp && note.rendered === 1);

  console.log('\n— شیت اقدام‌ها —');
  await page.click('.more-btn');
  await page.waitForSelector('.sheet');
  await page.waitForTimeout(300);
  const sheet = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.sheet-item')].map(b => b.textContent);
    const r = document.querySelector('.sheet').getBoundingClientRect();
    return {
      items: items.length,
      hasNew: items.some(t => t.indexOf('پروندهٔ جدید') >= 0),
      hasBackup: items.some(t => t.indexOf('پشتیبان') >= 0),
      hasSettings: items.some(t => t.indexOf('تنظیمات') >= 0),
      tallEnough: [...document.querySelectorAll('.sheet-item')]
        .every(b => b.getBoundingClientRect().height >= 44),
      gap: window.innerHeight - r.bottom
    };
  });
  check('همهٔ اقدام‌های نوار بالا در شیت هستند',
    sheet.hasNew && sheet.hasBackup && sheet.hasSettings, sheet.items + ' اقدام');
  check('هدف‌های لمسی به‌اندازهٔ انگشت‌اند', sheet.tallEnough);
  check('شیت از پایین صفحه باز می‌شود', Math.abs(sheet.gap) < 2,
    Math.round(sheet.gap) + 'px تا کف');
  await page.click('.sheet-close');

  console.log('\n— رفت‌وآمد با نوار پایین —');
  const nav = [];
  for (const [i, view] of [['work'], ['list'], ['people'], ['report']].entries()) {
    await page.evaluate((k) => {
      [...document.querySelectorAll('.tab-btn')]
        .find(b => b.getAttribute('data-nav') === k).click();
    }, view[0]);
    await page.waitForTimeout(400);
    nav.push(await page.evaluate((k) => {
      const btn = [...document.querySelectorAll('.tab-btn')]
        .find(b => b.getAttribute('data-nav') === k);
      return btn.classList.contains('active');
    }, view[0]));
  }
  check('هر چهار مقصد با نوار پایین باز می‌شوند و نشان‌دار می‌مانند',
    nav.every(Boolean), nav.filter(Boolean).length + ' از ۴');

  console.log('\n— چرخاندن گوشی و بازگشت به رایانه —');
  await page.setViewportSize({ width: 780, height: 390 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.App.goList());
  await page.waitForTimeout(500);
  const landscape = await page.evaluate(() => ({
    phone: window.Mobile.isPhone(),
    table: document.querySelectorAll('.tr').length > 0,
    cards: document.querySelectorAll('.case-card').length > 0
  }));
  // ۷۸۰ پیکسل دیگر گوشی نیست: باید به جدول برگردد
  check('با پهن شدن صفحه، دوباره جدول می‌شود',
    !landscape.phone && landscape.table && !landscape.cards);

  await page.setViewportSize(PHONE);
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => ({
    phone: window.Mobile.isPhone(),
    cards: document.querySelectorAll('.case-card').length > 0
  }));
  check('و با باریک شدن، دوباره کارت', back.phone && back.cards);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
