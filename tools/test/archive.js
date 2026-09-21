/*
 * تست بایگانی اسناد: بارگذاری دسته‌ای، تگ، سندِ بی‌پرونده، و وصل کردنش
 * به پرونده.
 *
 * سه چیز اینجا حیاتی است:
 *   — سربرگ «روی همه بنشان» باید واقعاً روی همه بنشیند، وگرنه برای
 *     بیست اسکن باید بیست بار نوع و تاریخ زد و کسی نمی‌زند.
 *   — سندِ پرونده‌دار در پوشهٔ پروندهٔ خودش بماند، نه داخل دسته. دسته
 *     ظرف نیست؛ برچسب است.
 *   — «وصل به پرونده» فقط فراداده را عوض نکند: فایل هم باید جابه‌جا شود،
 *     وگرنه دو حقیقت داریم و یکی‌شان دروغ است.
 *
 * اجرا:  node tools/test/archive.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const bootApp = require('./boot');
const MOCK_FS = require('./mockfs');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
  const files = [];
  for (let i = 1; i <= 5; i++) {
    const f = path.join(dir, '1405-06-30-ray-' + i + '.pdf');
    fs.writeFileSync(f, 'scan ' + i);
    files.push(f);
  }
  /* یکی از فایل‌ها نام یکتا دارد تا بشود سنجید جستجو واقعاً روی نام فایل
     کار می‌کند. با شش فایلِ هم‌نام، هر توکنی به همه می‌خورد. */
  const odd = path.join(dir, 'ebligh-vizhe.pdf');
  fs.writeFileSync(odd, 'scan 6');
  files.push(odd);

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await bootApp(page, APP);
  await page.evaluate(MOCK_FS);
  await page.evaluate(() => window.Docs.linkFolder());

  console.log('\n— نمای بایگانی —');
  await page.evaluate(() => window.App.goArchive());
  await page.waitForSelector('.arc-view');
  const view = await page.evaluate(() => ({
    hash: location.hash,
    nav: (document.querySelector('.nav-btn.active') || {}).textContent,
    drop: !!document.querySelector('.arc-drop'),
    empty: !!document.querySelector('.arc-view .empty-state')
  }));
  check('نما نشانی و جای خودش را دارد',
    view.hash === '#/archive' && view.nav === 'بایگانی', view.hash);
  check('کادر رها کردن فایل هست و بایگانی خالی صریح می‌گوید خالی است',
    view.drop && view.empty);

  // ------------------------------------------------- بارگذاری دسته‌ای
  console.log('\n— بارگذاری دسته‌ای —');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      [...document.querySelectorAll('.arc-plate button')]
        .find(b => /بارگذاری دسته‌ای/.test(b.textContent)).click();
    })
  ]);
  await chooser.setFiles(files);
  await page.waitForSelector('.doc-add-modal');
  await page.waitForTimeout(400);

  const applied = await page.evaluate(async () => {
    const m = document.querySelector('.doc-add-modal');
    const head = m.querySelector('.batch-head');
    const kind = head.querySelector('select.input.small');
    kind.value = 'رأی کمیته';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    const d = head.querySelector('.date-field input');
    d.value = '1405/06/30';
    d.dispatchEvent(new Event('input', { bubbles: true }));
    d.dispatchEvent(new Event('change', { bubbles: true }));
    d.blur();
    const ti = head.querySelector('.tag-input');
    ti.value = 'آرا';
    ti.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const bn = [...head.querySelectorAll('input.input')]
      .find(i => /اسکن آرای/.test(i.placeholder || ''));
    bn.value = 'اسکن آرای صادره';
    bn.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    head.querySelector('.batch-apply').click();
    await new Promise(r => setTimeout(r, 300));
    const rows = [...m.querySelectorAll('.doc-add-row')];
    return {
      rows: rows.length,
      kinds: rows.map(r => r.querySelector('select.input.small').value),
      dates: rows.map(r => r.querySelector('.date-field input').value),
      tags: rows.map(r => r.querySelectorAll('.tag-chip').length)
    };
  });
  /* تاریخِ داخل نام فایل نباید به‌عنوان شمارهٔ نامه خوانده شود؛ در یک
     دستهٔ بیست‌تایی یعنی بیست شمارهٔ غلط. */
  const guessed = await page.evaluate(() =>
    [...document.querySelectorAll('.doc-add-row')].map(r => {
      const i = [...r.querySelectorAll('input.input')]
        .find(x => x.placeholder === 'شمارهٔ نامه');
      return i ? i.value : '?';
    }));
  check('تاریخِ داخل نام فایل، شمارهٔ نامه خوانده نمی‌شود',
    guessed.every(v => !v || v.indexOf('1405-06-30') < 0),
    guessed.slice(0, 3).join(' | '));

  check('سربرگ روی هر شش فایل نشست — نوع، تاریخ و تگ',
    applied.rows === 6 &&
    applied.kinds.every(k => k === 'رأی کمیته') &&
    applied.dates.every(d => d === '1405/06/30') &&
    applied.tags.every(n => n === 1),
    applied.rows + ' سطر');

  const badDate = await page.evaluate(async () => {
    const head = document.querySelector('.batch-head');
    const d = head.querySelector('.date-field input');
    d.value = '۱۴۰۵/۹۹/۹۹';
    d.dispatchEvent(new Event('input', { bubbles: true }));
    d.dispatchEvent(new Event('change', { bubbles: true }));
    d.blur();
    await new Promise(r => setTimeout(r, 150));
    head.querySelector('.batch-apply').click();
    await new Promise(r => setTimeout(r, 200));
    const rows = [...document.querySelectorAll('.doc-add-row')];
    return rows.map(r => r.querySelector('.date-field input').value);
  });
  check('تاریخِ خوانده‌نشده روی بیست فایل نمی‌نشیند',
    badDate.every(d => d === '1405/06/30'), badDate[0]);

  const routed = await page.evaluate(async () => {
    const rec = window.Model.state.cases[0];
    const rows = [...document.querySelectorAll('.doc-add-row')];
    const ci = rows[2].querySelector('.dcase-field input');
    ci.value = rec.caseNo;
    ci.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    return {
      hint: rows[2].querySelector('.dcase-hint').textContent,
      others: rows[0].querySelector('.dcase-hint').textContent
    };
  });
  check('یک سطر می‌تواند پروندهٔ خودش را بگیرد، بقیه دست‌نخورده',
    /1404/.test(routed.hint) && /بی‌پرونده/.test(routed.others), routed.hint);

  const saved = await page.evaluate(async () => {
    [...document.querySelectorAll('.doc-add-modal .btn.primary')].pop().click();
    await new Promise(r => setTimeout(r, 2500));
    const b = window.Docs.batches()[0];
    const caseId = window.Model.state.cases[0].id;
    const onCase = window.Docs.current(caseId);
    return {
      batches: window.Docs.batches().length,
      name: b && b.name, n: b && b.docs.length,
      caseCount: b && b.caseCount, general: b && b.general,
      generalTotal: window.Docs.general().length,
      onCase: onCase.length,
      onCaseFolder: onCase[0] && onCase[0].folderName,
      generalFolder: window.Docs.general()[0].folderName,
      tags: window.Docs.tagsInUse()
    };
  });
  check('یک دسته ساخته شد با نام و تعداد درست',
    saved.batches === 1 && saved.name === 'اسکن آرای صادره' && saved.n === 6,
    saved.name + ' — ' + saved.n + ' سند');
  check('دسته هم سندِ پرونده‌دار دارد هم بی‌پرونده',
    saved.caseCount === 1 && saved.general === 5,
    saved.caseCount + ' پرونده، ' + saved.general + ' بی‌پرونده');
  /* مهم‌ترین بند: دسته ظرف نیست. سندِ پرونده‌دار در پوشهٔ خودِ پرونده
     نشسته، نه داخل پوشهٔ دسته. */
  check('سندِ پرونده‌دار در پوشهٔ پروندهٔ خودش نشست، نه در پوشهٔ دسته',
    saved.onCase === 1 && saved.onCaseFolder.indexOf('_بایگانی') < 0,
    saved.onCaseFolder);
  check('سندِ بی‌پرونده زیر «_بایگانی/سال/نام دسته» نشست',
    /^_بایگانی\/1405\/1405-06-30 اسکن آرای صادره$/.test(saved.generalFolder),
    saved.generalFolder);
  check('تگ روی همه نشست و وارد فهرست تگ‌ها شد',
    saved.tags.indexOf('آرا') >= 0, saved.tags.join('، '));

  // ------------------------------------------------------------ جستجو
  console.log('\n— جستجوی سندمحور —');
  const search = await page.evaluate(() => ({
    byTag: window.Docs.searchDocs('', { tags: ['آرا'] }).length,
    byKind: window.Docs.searchDocs('', { kind: 'رأی کمیته' }).length,
    byText: window.Docs.searchDocs('vizhe').length,
    byBatchName: window.Docs.searchDocs('آرای صادره').length,
    onlyGeneral: window.Docs.searchDocs('', { scope: 'general' }).length,
    nothing: window.Docs.searchDocs('چیزی-که-نیست').length
  }));
  check('جستجو با تگ، نوع، نام فایل و نام دسته کار می‌کند',
    search.byTag === 6 && search.byKind === 6 && search.byText === 1 &&
    search.byBatchName === 6, JSON.stringify(search));
  check('صافی دامنه فقط بی‌پرونده‌ها را می‌آورد', search.onlyGeneral === 5);
  check('جستجوی بی‌نتیجه، بی‌نتیجه است', search.nothing === 0);

  // -------------------------------------------------- وصل به پرونده
  console.log('\n— وصل کردن سندِ بی‌پرونده به پرونده —');
  const attached = await page.evaluate(async () => {
    const doc = window.Docs.general()[0];
    const rec = window.Model.state.cases[1];
    const before = {
      folder: doc.folderName, scope: doc.scope, name: doc.fileName,
      inCase: window.Docs.current(rec.id).length,
      general: window.Docs.general().length
    };
    await window.Docs.attachToCase(doc, rec);
    // فایل باید در پوشهٔ تازه باشد و در پوشهٔ قدیمی نباشد
    let readable = false;
    try { await window.Docs.readFile(doc); readable = true; } catch (e) { /* نه */ }
    return {
      before: before,
      after: { folder: doc.folderName, scope: doc.scope, caseNo: doc.caseNo },
      inCase: window.Docs.current(rec.id).length,
      general: window.Docs.general().length,
      readable: readable,
      history: window.Model.historyFor(rec.id).some(h => h.kind === 'doc-attach')
    };
  });
  check('سند از بایگانی به پرونده رفت',
    attached.after.scope === 'case' &&
    attached.after.folder.indexOf('_بایگانی') < 0 &&
    attached.inCase === attached.before.inCase + 1 &&
    attached.general === attached.before.general - 1,
    attached.before.folder + ' → ' + attached.after.folder);
  check('و خودِ فایل هم جابه‌جا شد، نه فقط فراداده', attached.readable);
  check('در تاریخچهٔ پرونده ثبت شد', attached.history);

  const notTwice = await page.evaluate(async () => {
    const doc = window.Docs.current(window.Model.state.cases[1].id)
      .filter(d => d.batchId)[0];
    try {
      await window.Docs.attachToCase(doc, window.Model.state.cases[2]);
      return '';
    } catch (e) { return e.message; }
  });
  check('سندی که از قبل پرونده دارد، دوباره وصل نمی‌شود',
    /از قبل/.test(notTwice), notTwice);

  // ------------------------------------------------------------ نما
  console.log('\n— فهرست و دسته در نما —');
  const ui = await page.evaluate(async () => {
    window.App.goArchive();
    await new Promise(r => setTimeout(r, 500));
    return {
      batches: document.querySelectorAll('.arc-batch').length,
      docs: document.querySelectorAll('.arc-doc').length,
      loose: document.querySelectorAll('.arc-loose').length,
      onCase: document.querySelectorAll('.arc-on-case').length,
      attachBtns: [...document.querySelectorAll('.arc-doc button')]
        .filter(b => b.textContent === 'وصل به پرونده').length
    };
  });
  check('دسته و سندها در نما دیده می‌شوند',
    ui.batches === 1 && ui.docs === 6, ui.docs + ' سند در ' + ui.batches + ' دسته');
  check('سند بی‌پرونده دکمهٔ «وصل به پرونده» دارد و پرونده‌دار ندارد',
    ui.attachBtns === ui.loose && ui.onCase === 2,
    ui.loose + ' بی‌پرونده، ' + ui.onCase + ' در پرونده');

  const filtered = await page.evaluate(async () => {
    [...document.querySelectorAll('.arc-filters .chip-btn')]
      .find(b => b.textContent === 'بی‌پرونده').click();
    await new Promise(r => setTimeout(r, 400));
    return document.querySelectorAll('.arc-doc').length;
  });
  check('صافی «بی‌پرونده» فهرست را باریک می‌کند', filtered === 4, filtered + ' سند');

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
