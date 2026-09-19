/*
 * تست قابلیت‌های تازهٔ مستندات:
 *   نمایشگر سند، متن نامه، وارده/صادره، دسته‌بندی، خروجی زیپ،
 *   و دکمهٔ آلارم که مستقیم بارگذاری را باز می‌کند.
 *
 * اجرا:  node tools/test/dossier.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');
const MOCK_FS = require('./mockfs');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

/* یک PNG واقعی و کوچک. با فایل قلابی نمی‌شود سنجید که «عکس نمایش داده
   می‌شود» — مرورگر هر بایتی را عکس حساب نمی‌کند. */
const PNG_B64 = (() => {
  const zlib = require('zlib');
  const W = 24, H = 16;
  function crc32(buf) {
    let c, crc = 0xFFFFFFFF;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xFF;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crc = c ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  }
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = [0];                       // فیلتر هر سطر: بدون فیلتر
    for (let x = 0; x < W; x++) row.push(240, 200, 120);
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;                // ۸ بیت، RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]).toString('base64');
})();

/** یک فایل ساختگی با محتوای معلوم، تا بشود اندازه و سلامتش را سنجید */
function fakeFile(name, text, type) {
  return `new File([${JSON.stringify(text || 'x')}], ${JSON.stringify(name)}, ` +
    `{ type: ${JSON.stringify(type || 'application/pdf')} })`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ||
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR', acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(MOCK_FS);
  await page.evaluate(() => window.Docs.linkFolder());
  await page.waitForTimeout(300);

  const recId = await page.evaluate(() => {
    const c = window.Model.state.cases.slice()
      .sort((a, b) => (a.caseNo || '') < (b.caseNo || '') ? -1 : 1)[0];
    return c.id;
  });

  // ---------------------------------------------------------------------
  console.log('\n— نوع، دسته و جهت نامه —');

  // File را نمی‌شود از Node فرستاد؛ داخل خود صفحه ساخته می‌شود
  const docsMade = await page.evaluate(`(async () => {
    const rec = window.Model.get(${JSON.stringify(recId)});
    const D = window.Docs;
    const made = [];
    made.push(await D.addFile(rec, ${fakeFile('gozaresh.pdf', 'aaa')},
      { kind: 'گزارش بازرسی', docDate: '14040701',
        letterNo: '۱۴۰۴/۱۱', body: 'نامبرده در تاریخ ۱۴۰۴/۰۶/۳۰ غیبت داشته است.' }));
    made.push(await D.addFile(rec, ${fakeFile('davat.pdf', 'bbb')},
      { kind: 'دعوت‌نامهٔ جلسه', docDate: '14040705' }));
    made.push(await D.addFile(rec, (function () {
      var raw = atob(${JSON.stringify(PNG_B64)});
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return new File([arr], 'defa.png', { type: 'image/png' });
    })(), { kind: 'دفاعیهٔ کتبی', docDate: '14040710' }));
    made.push(await D.addFile(rec, ${fakeFile('hokm.docx', 'ddd',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document')},
      { kind: 'حکم کارگزینی', docDate: '14040620' }));
    return made.map(d => ({ id: d.id, kind: d.kind, category: d.category,
      direction: d.direction, body: d.body || '', fileName: d.fileName }));
  })()`);

  check('دسته از روی نوع سند خودکار درمی‌آید',
    docsMade[0].category === 'report' && docsMade[1].category === 'letters' &&
    docsMade[2].category === 'defense' && docsMade[3].category === 'identity',
    docsMade.map(d => d.category).join('/'));
  check('وارده و صادره از نوع سند حدس زده می‌شود',
    docsMade[0].direction === 'in' && docsMade[1].direction === 'out' &&
    docsMade[2].direction === 'in' && docsMade[3].direction === '',
    docsMade.map(d => d.direction || '—').join('/'));
  check('جهت از نوع سند جداست و برچسب فارسی دارد',
    await page.evaluate(() => window.Docs.directionLabel('in') === 'وارده' &&
      window.Docs.directionLabel('out') === 'صادره' &&
      window.Docs.directionLabel('') === ''));

  // ---------------------------------------------------------------------
  console.log('\n— متن نامه —');
  check('متن نامه با سند ذخیره می‌شود', /غیبت داشته است/.test(docsMade[0].body));

  const searchHit = await page.evaluate((id) => {
    const rec = window.Model.get(id);
    return {
      inIndex: /غیبت داشته است/.test(rec._docText || ''),
      found: window.Model.query({ q: 'غیبت داشته' }).some(r => r.id === id)
    };
  }, recId);
  check('متن نامه در جستجوی پرونده پیدا می‌شود',
    searchHit.inIndex && searchHit.found, JSON.stringify(searchHit));

  const edited = await page.evaluate((info) => {
    const doc = window.Docs.all().filter(d => d.id === info.id)[0];
    return window.Docs.updateMeta(doc, {
      kind: 'نامهٔ صادره', body: 'متن اصلاح‌شدهٔ نامه.', letterNo: '۱۴۰۴/۹۹'
    }).then(d => ({ kind: d.kind, cat: d.category, dir: d.direction, body: d.body }));
  }, { id: docsMade[0].id });
  check('مشخصات و متن سند بعداً قابل ویرایش است',
    edited.kind === 'نامهٔ صادره' && edited.cat === 'letters' &&
    edited.dir === 'out' && /اصلاح‌شده/.test(edited.body), JSON.stringify(edited));

  const histOk = await page.evaluate((id) =>
    window.Model.historyFor(id).some(h => h.kind === 'doc-edit'), recId);
  check('ویرایش سند در تاریخچهٔ پرونده می‌نشیند', histOk);

  // ---------------------------------------------------------------------
  console.log('\n— خروجی زیپ —');
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate((id) => {
    const rec = window.Model.get(id);
    return window.UIDocs.zipDocs(window.Docs.current(id), rec);
  }, recId);
  const zipFile = path.join(OUT, 'madarek.zip');
  const d = await dl;
  await d.saveAs(zipFile);
  check('نام فایل زیپ لاتین است تا روی file:// از دست نرود',
    /^madarek.*\.zip$/.test(d.suggestedFilename()), d.suggestedFilename());

  const listing = execFileSync('unzip', ['-l', zipFile]).toString();
  check('هر چهار سند و یک فهرست داخل بسته هستند',
    (listing.match(/\.(pdf|png|docx)\s*$/gm) || []).length === 4 &&
    /فهرست\.txt/.test(listing),
    (listing.match(/\.(pdf|png|docx)/g) || []).length + ' فایل');
  check('بستهٔ زیپ سالم است', /No errors detected/.test(
    execFileSync('unzip', ['-t', zipFile]).toString()));

  const manifest = execFileSync('unzip', ['-p', zipFile, 'فهرست.txt']).toString();
  check('فهرست، نوع و جهت و شمارهٔ هر سند را می‌نویسد',
    /نامهٔ صادره \(صادره\)/.test(manifest) && /دفاعیهٔ کتبی \(وارده\)/.test(manifest) &&
    /حکم کارگزینی/.test(manifest), manifest.split('\n')[3]);

  check('نام فارسی فایل‌ها داخل زیپ سالم می‌ماند',
    /گزارش|دعوت|دفاعیه|حکم/.test(listing), 'نام‌ها با UTF-8');

  // زیپ فقط از انتخاب‌شده‌ها
  const dl2 = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate((ids) => {
    const picked = window.Docs.all().filter(d => ids.indexOf(d.id) >= 0);
    return window.UIDocs.zipDocs(picked, window.Model.get(picked[0].caseId));
  }, [docsMade[0].id, docsMade[1].id]);
  const partial = path.join(OUT, 'partial.zip');
  await (await dl2).saveAs(partial);
  const plist = execFileSync('unzip', ['-l', partial]).toString();
  check('خروجی زیپِ چند سند انتخابی، فقط همان‌ها را دارد',
    (plist.match(/\.(pdf|png|docx)/g) || []).length === 2, plist.match(/\d+ files/) || '');

  // ---------------------------------------------------------------------
  console.log('\n— نمایشگر سند —');
  await page.evaluate((id) => window.App.openCase(id), recId);
  await page.waitForSelector('.case-view');
  await page.evaluate(() => {
    [...document.querySelectorAll('.tab')]
      .filter(t => /مستندات/.test(t.textContent))[0].click();
  });
  await page.waitForSelector('.doc-list');
  await page.waitForTimeout(400);

  await page.evaluate(() => document.querySelector('.doc-list .doc-thumb').click());
  await page.waitForSelector('.vw-box');
  await page.waitForTimeout(500);
  const viewer = await page.evaluate(() => ({
    title: (document.querySelector('.vw-title') || {}).textContent || '',
    chips: [...document.querySelectorAll('.vw-chip')].map(c => c.textContent),
    count: (document.querySelector('.vw-count') || {}).textContent || '',
    hasDownload: [...document.querySelectorAll('.vw-foot .btn')]
      .some(b => b.textContent === 'دانلود'),
    nav: document.querySelectorAll('.vw-nav').length,
    shows: !!document.querySelector('.vw-img, .vw-pdf, .vw-none')
  }));
  check('کلیک روی سند، نمایشگر را همین‌جا باز می‌کند، نه برگهٔ تازه',
    !!viewer.title && viewer.shows, viewer.title);
  check('نمایشگر نوع، جهت و تاریخ سند را نشان می‌دهد',
    viewer.chips.length >= 3, viewer.chips.join(' | '));
  check('دکمهٔ دانلود در نمایشگر هست', viewer.hasDownload);
  check('با فلش می‌شود بین اسناد پرونده ورق زد',
    viewer.nav === 2 && /از/.test(viewer.count), viewer.count);

  // عکس واقعاً باید رندر شود، نه فقط تگ img ساخته شود
  await page.evaluate(() => document.querySelector('.vw-head .icon-btn').click());
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    // سند عکس ممکن است پایین فهرست باشد و هنوز رندر نشده؛ مستقیم بازش می‌کنیم
    const pic = window.Docs.all().filter(d => /\.png$/.test(d.fileName));
    window.UIViewer.open(pic, 0);
  });
  await page.waitForSelector('.vw-img', { timeout: 8000 });
  await page.waitForTimeout(500);
  const pixels = await page.evaluate(() => {
    const im = document.querySelector('.vw-img');
    return { w: im.naturalWidth, h: im.naturalHeight };
  });
  check('عکس واقعاً در نمایشگر دیده می‌شود، نه آیکن شکسته',
    pixels.w === 24 && pixels.h === 16, JSON.stringify(pixels));

  const zoomed = await page.evaluate(() => {
    document.querySelector('.vw-img').click();
    return document.querySelector('.vw-stage').classList.contains('vw-fit');
  });
  check('کلیک روی عکس، بزرگ‌نمایی می‌کند', zoomed);

  const dl3 = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.vw-foot .btn')]
      .filter(b => b.textContent === 'دانلود')[0].click();
  });
  const got = await dl3;
  check('دانلود از داخل نمایشگر، خود فایل را می‌دهد',
    !!got.suggestedFilename(), got.suggestedFilename());

  await page.evaluate(() => document.querySelector('.vw-head .icon-btn').click());
  await page.waitForTimeout(300);
  check('نمایشگر بسته می‌شود',
    await page.evaluate(() => !document.querySelector('.vw-box')));

  // ---------------------------------------------------------------------
  console.log('\n— دسته‌بندی در فهرست —');
  const cats = await page.evaluate(() =>
    [...document.querySelectorAll('.doc-cat-name')].map(n => n.textContent));
  check('مستندات پرونده زیر سرفصل دسته‌ها می‌آیند',
    cats.length >= 2 && cats.indexOf('مکاتبات') >= 0, cats.join(' | '));
  check('هر دسته دکمهٔ زیپ خودش را دارد',
    await page.evaluate(() =>
      document.querySelectorAll('.doc-cat-head .linkish').length >= 2));

  const picked = await page.evaluate(() => {
    const box = document.querySelector('.doc-pick input');
    box.click();
    return {
      on: document.querySelector('.doc-pickbar').classList.contains('on'),
      text: document.querySelector('.doc-pickbar').textContent
    };
  });
  check('انتخاب سند، نوار «خروجی زیپ» را می‌آورد',
    picked.on && /انتخاب شده/.test(picked.text) && /خروجی زیپ/.test(picked.text),
    picked.text);

  // ---------------------------------------------------------------------
  console.log('\n— آلارم قابل کلیک —');
  const ctaAll = await page.evaluate(() => {
    const keys = Object.keys(window.Worklist.CTA);
    return keys.map(k => ({ k: k, t: window.Worklist.CTA[k].type }));
  });
  // پانزده مرحله به‌علاوهٔ «پیگیری دفاعیات» که مرحلهٔ جدا ندارد ولی اقدام دارد
  check('برای هر مرحله، یک اقدام یک‌کلیکی تعریف شده',
    ctaAll.length === 16 &&
    ctaAll.every(c => ['upload', 'form', 'field'].indexOf(c.t) >= 0),
    ctaAll.length + ' مرحله');

  const fresh = await page.evaluate(async () => {
    const M = window.Model;
    const rec = await M.create({
      caseNo: '1404999', firstName: 'سارا', lastName: 'احمدی',
      intakeDate: window.J.today(), deliveryDate: window.J.today()
    });
    return rec.id;
  });
  await page.evaluate((id) => window.App.openCase(id), fresh);
  await page.waitForSelector('.case-next');
  await page.waitForTimeout(300);
  const alarm = await page.evaluate(() => ({
    label: (document.querySelector('.case-next-label') || {}).textContent || '',
    cta: (document.querySelector('.case-cta') || {}).textContent || ''
  }));
  check('آلارمِ «بارگذاری حکم» دکمهٔ بارگذاری دارد',
    /بارگذاری آخرین حکم/.test(alarm.label) && /بارگذاری/.test(alarm.cta),
    alarm.label + ' → ' + alarm.cta);

  // آلارمی که کارش ثبت تاریخ است، به همان فیلد می‌پرد
  await page.evaluate((id) => {
    const rec = window.Model.get(id);
    return window.Model.update(id, Object.assign({}, rec, {
      decreeDate: window.J.today(), invitationLetterDate: window.J.today(),
      defenseReceivedDate: window.J.today(), docsCompleteDate: window.J.today()
    }));
  }, fresh);
  await page.evaluate((id) => window.App.openCase(id), fresh);
  await page.waitForSelector('.case-cta');
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('.case-cta').click());
  await page.waitForTimeout(500);
  const jumped = await page.evaluate(() => {
    const n = document.querySelector('[data-field="committeeDate"]');
    return {
      exists: !!n,
      flashed: !!(n && n.classList.contains('field-flash')),
      tab: (document.querySelector('.tab.active') || {}).textContent || ''
    };
  });
  check('آلارمِ «ثبت تاریخ جلسه» تب درست را باز و فیلد را روشن می‌کند',
    jumped.exists && jumped.flashed, JSON.stringify(jumped));

  // ---------------------------------------------------------------------
  console.log('\n— تنظیم دستی مرحله —');

  const manual = await page.evaluate(async () => {
    const M = window.Model, WL = window.Worklist, J = window.J;
    const rec = await M.create({
      caseNo: '1404998', firstName: 'مریم', lastName: 'کاظمی',
      intakeDate: J.addDays(J.today(), -40), deliveryDate: J.addDays(J.today(), -38)
    });
    const before = WL.nextAction(M.get(rec.id));
    // پرونده عملاً سرِ جلسهٔ دفاع است، ولی تاریخ‌های میانی وارد نشده
    await M.applyPatches([{ id: rec.id, patch: {
      stageOverride: 'hearing',
      stageOverrideDate: J.addDays(J.today(), -10),
      stageOverrideNote: 'تاریخ‌های میانی هنوز وارد نشده'
    } }], { kind: 'stage', note: 'آزمون' });
    const after = WL.nextAction(M.get(rec.id));
    const steps = WL.stages(M.get(rec.id));
    return {
      id: rec.id,
      beforeKey: before.key, beforeLabel: before.label,
      afterKey: after.key, afterLabel: after.label,
      manual: !!after.manual, autoKey: after.autoKey, autoLabel: after.autoLabel,
      days: after.days,
      currentStage: (steps.filter(s => s.current)[0] || {}).key,
      manualStage: (steps.filter(s => s.manual)[0] || {}).key,
      // تاریخ‌ها نباید دست بخورند
      dates: steps.filter(s => s.date).map(s => s.key).join(',')
    };
  });
  check('بدون تنظیم دستی، مرحله از روی تاریخ‌ها حساب می‌شود',
    manual.beforeKey === 'decree', manual.beforeLabel);
  check('مرحلهٔ دستی بر محاسبهٔ خودکار می‌چربد',
    manual.afterKey === 'hearing' && manual.manual === true, manual.afterLabel);
  check('محاسبهٔ خودکار پنهان نمی‌شود، کنارش گفته می‌شود',
    manual.autoKey === 'decree' && !!manual.autoLabel, manual.autoLabel);
  check('روزشمار از تاریخی که کاربر داده حساب می‌شود', manual.days === 10,
    manual.days + ' روز');
  check('«اکنون» روی ریل به مرحلهٔ دستی می‌رود',
    manual.currentStage === 'hearing' && manual.manualStage === 'hearing',
    manual.currentStage);
  check('تاریخ‌های ثبت‌شده دست نمی‌خورند',
    manual.dates === 'intake,assign', manual.dates);

  await page.evaluate((id) => window.App.openCase(id), manual.id);
  await page.waitForSelector('.case-next');
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => ({
    tag: !!document.querySelector('.stage-manual-tag'),
    auto: (document.querySelector('.case-next-auto') || {}).textContent || '',
    btn: (document.querySelector('.case-stage') || {}).textContent || '',
    railManual: document.querySelectorAll('.rail-step.manual').length
  }));
  check('بالای پرونده معلوم است که مرحله دستی است',
    shown.tag && /بر اساس تاریخ‌های ثبت‌شده/.test(shown.auto) &&
    shown.railManual === 1, shown.auto);
  check('دکمهٔ تغییر مرحله در دسترس است', /تغییر مرحله/.test(shown.btn), shown.btn);

  await page.evaluate(() => document.querySelector('.case-stage').click());
  await page.waitForSelector('.stage-pick');
  await page.waitForTimeout(250);
  const picker = await page.evaluate(() => ({
    options: document.querySelectorAll('.stage-opt').length,
    selected: (document.querySelector('.stage-opt.on .stage-opt-label') || {}).textContent,
    autoMark: (document.querySelector('.stage-opt-auto') || {}).textContent,
    canRevert: [...document.querySelectorAll('.modal-foot .btn')]
      .some(b => /خودکار/.test(b.textContent))
  }));
  check('پنجرهٔ مرحله، هر پانزده مرحله را با انتخاب فعلی نشان می‌دهد',
    picker.options === 15 && picker.selected === 'جلسهٔ دفاع' &&
    picker.autoMark === 'خودکار', JSON.stringify(picker));
  check('راه برگشت به حالت خودکار هست', picker.canRevert);

  await page.evaluate(() => {
    [...document.querySelectorAll('.modal-foot .btn')]
      .filter(b => /خودکار/.test(b.textContent))[0].click();
  });
  await page.waitForTimeout(700);
  const reverted = await page.evaluate((id) =>
    window.Worklist.nextAction(window.Model.get(id)), manual.id);
  check('برگشت به خودکار، دوباره از تاریخ‌ها حساب می‌کند',
    reverted.key === 'decree' && !reverted.manual, reverted.label);

  // ---------------------------------------------------------------------
  console.log('\n— آلارم بعد از بارگذاری خاموش می‌شود —');

  const freshId = await page.evaluate(async () => {
    const r = await window.Model.create({
      caseNo: '1404997', firstName: 'نرگس', lastName: 'رستمی',
      intakeDate: window.J.today(), deliveryDate: window.J.today()
    });
    return r.id;
  });
  await page.evaluate((id) => window.App.openCase(id), freshId);
  await page.waitForSelector('.case-cta');
  await page.waitForTimeout(300);
  const beforeUpload = await page.evaluate(() => ({
    label: document.querySelector('.case-next-label').textContent,
    cta: document.querySelector('.case-cta').textContent
  }));
  check('آلارم «بارگذاری آخرین حکم» است',
    /بارگذاری آخرین حکم/.test(beforeUpload.label), beforeUpload.label);

  // دکمهٔ آلارم، انتخاب‌گر فایل را باز می‌کند؛ همان‌جا فایل را می‌دهیم
  const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
  await page.evaluate(() => document.querySelector('.case-cta').click());
  const fc = await chooser;
  const tmp = path.join(OUT, 'hokm.pdf');
  fs.writeFileSync(tmp, '%PDF-1.4 test');
  await fc.setFiles(tmp);
  await page.waitForSelector('.doc-add', { timeout: 8000 });
  await page.waitForTimeout(300);

  const preset = await page.evaluate(() =>
    document.querySelector('.doc-add-fields select').value);
  check('نوع سند از پیش روی «حکم کارگزینی» است', preset === 'حکم کارگزینی', preset);

  // تاریخ سند را عقب‌تر از امروز می‌گذاریم تا معلوم شود از سند می‌آید نه از امروز
  const docDay = await page.evaluate(() => {
    const d = window.J.addDays(window.J.today(), -3);
    window.__wanted = d;
    const inp = document.querySelector('.doc-add-fields .date-input');
    inp.value = window.J.format(d, { latin: true });
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return d;
  });
  await page.evaluate(() => {
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
  });
  await page.waitForTimeout(1200);

  const afterUpload = await page.evaluate((id) => {
    const rec = window.Model.get(id);
    const a = window.Worklist.nextAction(rec);
    return {
      decreeDate: rec.decreeDate || '',
      label: (document.querySelector('.case-next-label') || {}).textContent || '',
      actionKey: a.key,
      docs: window.Docs.current(id).length
    };
  }, freshId);
  check('سند ثبت شد و تاریخ مرحله از روی تاریخِ سند پر شد',
    afterUpload.docs === 1 && afterUpload.decreeDate === docDay,
    afterUpload.decreeDate + ' (انتظار ' + docDay + ')');
  check('آلارم عوض شد و روی مرحلهٔ بعدی رفت',
    afterUpload.actionKey !== 'decree' && !/بارگذاری آخرین حکم/.test(afterUpload.label),
    afterUpload.label);

  const notOverwritten = await page.evaluate(async (id) => {
    const M = window.Model;
    const rec = M.get(id);
    const keep = rec.invitationLetterDate || window.J.addDays(window.J.today(), -20);
    await M.applyPatches([{ id: id, patch: { invitationLetterDate: keep } }],
      { kind: 'test', note: 'آزمون' });
    await window.Docs.addFile(M.get(id),
      new File(['x'], 'davat.pdf', { type: 'application/pdf' }),
      { kind: 'دعوت‌نامهٔ جلسه', docDate: window.J.today() });
    return { keep: keep, now: M.get(id).invitationLetterDate };
  }, freshId);
  check('تاریخی که کاربر خودش گذاشته، با سند تازه بازنویسی نمی‌شود',
    notOverwritten.keep === notOverwritten.now, JSON.stringify(notOverwritten));

  // ---------------------------------------------------------------------
  console.log('\n— پیوست نامه کنار فیلد —');
  await page.evaluate((id) => window.App.openCase(id), recId);
  await page.waitForSelector('.case-view');
  // تبِ فعال از پروندهٔ قبلی به‌خاطر مانده؛ برای این سنجه باید «پرونده» باشد
  await page.evaluate(() => {
    [...document.querySelectorAll('.tab')]
      .filter(t => /پرونده و شخص/.test(t.textContent))[0].click();
  });
  await page.waitForTimeout(400);
  const clips = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.field[data-field]').forEach(f => {
      const c = f.querySelector('.letter-clip');
      if (c) out.push({ field: f.dataset.field, has: c.classList.contains('has'),
        title: c.title });
    });
    return out;
  });
  check('کنار فیلدهای نامه، گیرهٔ پیوست هست',
    clips.length >= 3 && clips.some(c => c.field === 'letterNo'),
    clips.map(c => c.field).join(','));
  check('گیره می‌گوید چه نوع سندی پیوست می‌شود',
    clips.some(c => /نامهٔ وارده/.test(c.title)),
    (clips[0] || {}).title);

  await page.evaluate(() => {
    [...document.querySelectorAll('.tab')]
      .filter(t => /دعوت، دفاعیات/.test(t.textContent))[0].click();
  });
  await page.waitForTimeout(300);
  const inviteClip = await page.evaluate(() => {
    const f = document.querySelector('[data-field="invitationLetterDate"] .letter-clip');
    return f ? { has: f.classList.contains('has'), title: f.title,
      n: (f.querySelector('.letter-clip-n') || {}).textContent } : null;
  });
  check('فیلدی که سندش ثبت شده، تعداد را روی گیره نشان می‌دهد',
    inviteClip && inviteClip.has && inviteClip.n === '۱', JSON.stringify(inviteClip));

  await page.evaluate(() =>
    document.querySelector('[data-field="invitationLetterDate"] .letter-clip').click());
  await page.waitForSelector('.vw-box', { timeout: 8000 });
  await page.waitForTimeout(400);
  const viaClip = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.vw-chip')].map(c => c.textContent);
    document.querySelector('.vw-head .icon-btn').click();
    return t;
  });
  check('کلیک روی گیره، همان سند را باز می‌کند',
    viaClip.indexOf('دعوت‌نامهٔ جلسه') >= 0, viaClip.join(' | '));

  // ---------------------------------------------------------------------
  console.log('\n— تب دسته‌بندی تخلف حذف شده —');
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.tab')].map(t => t.textContent.trim()));
  check('تب «دسته‌بندی تخلف» دیگر نیست',
    !tabs.some(t => /دسته‌بندی تخلف/.test(t)), tabs.join(' | '));
  const kept = await page.evaluate(() => {
    const keys = window.Model.FIELDS.map(f => f.key);
    return {
      notes: (window.Model.FIELD_BY_KEY.notes || {}).group,
      gone: ['violationAdmin', 'violationFinancial', 'violationTechnical',
        'violationDisciplinary'].filter(k => keys.indexOf(k) >= 0),
      hidden: window.Model.FIELDS.filter(f => f.hidden).map(f => f.key)
    };
  });
  check('«توضیحات» حفظ شده و به تب پرونده رفته', kept.notes === 'case', kept.notes);
  check('چهار ستون دسته‌بندی تخلف حذف شده‌اند', kept.gone.length === 0,
    kept.gone.join(','));
  check('فیلدهای مرحلهٔ دستی پنهان‌اند و در فرم نمی‌آیند',
    kept.hidden.length === 3 &&
    !clips.some(c => /stageOverride/.test(c.field)), kept.hidden.join(','));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
