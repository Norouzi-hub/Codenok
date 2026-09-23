/*
 * تست صفحهٔ پرونده — چهار چیزی که در این دور عوض شد.
 *
 * مهم‌ترینش باگی است که کاربر پیدا کرد: سندی که بارگذاری می‌شود شمارهٔ
 * نامه و تاریخش را در پرونده می‌نشاند، ولی فرمِ باز آن را نشان نمی‌داد —
 * چون draft یک بار ساخته می‌شد و دیگر خوانده نمی‌شد. نیمهٔ خطرناک‌ترش
 * این بود که ذخیرهٔ بعدی همان خالی را روی داده می‌نوشت.
 *
 * اجرا:  node tools/test/caseform.js
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

/* یک دیسک ساختگی برای فایل دیتابیس، تا «به‌روزرسانی» را واقعی بسنجیم */
const FAKE_DISK = `(function () {
  window.__disk = {}; window.__handles = {};
  function mk(n) {
    return {
      kind: 'file', name: n,
      queryPermission: function () { return Promise.resolve('granted'); },
      requestPermission: function () { return Promise.resolve('granted'); },
      getFile: function () {
        return Promise.resolve(new File([window.__disk[n] || ''], n,
          { type: 'application/json' }));
      },
      createWritable: function () {
        var parts = [];
        return Promise.resolve({
          write: function (d) { parts.push(d); return Promise.resolve(); },
          close: function () {
            return new Blob(parts).text().then(function (t) { window.__disk[n] = t; });
          }
        });
      }
    };
  }
  function h(n) { if (!window.__handles[n]) window.__handles[n] = mk(n); return window.__handles[n]; }
  window.showSaveFilePicker = function (o) {
    return Promise.resolve(h((o && o.suggestedName) || 'db.json'));
  };
  window.showOpenFilePicker = function () {
    return Promise.resolve([h('parvandeha-db.json')]);
  };
})();`;

(async () => {
  const upload = path.join(os.tmpdir(), 'hozur-test.pdf');
  fs.writeFileSync(upload, 'pdf');

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

  // ============================================ سند، و فرمِ بازِ پرونده
  console.log('\n— سندی که بارگذاری می‌شود، در فرمِ باز هم دیده شود —');

  const caseId = await page.evaluate(() => {
    const r = window.Model.state.cases[0];
    window.App.state.formTab = '__docs';
    window.App.openCase(r.id);
    return r.id;
  });
  await page.waitForTimeout(500);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => {
      const b = [...document.querySelectorAll('.form-panel button')]
        .find(x => /افزودن سند|بارگذاری|＋/.test(x.textContent));
      b.click();
    })
  ]);
  await chooser.setFiles(upload);
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const m = document.querySelector('.overlay');
    const kindSel = [...m.querySelectorAll('select.input.small')]
      .find(s => [...s.options].some(o => o.value === 'نامهٔ حضور در جلسهٔ دفاع'));
    kindSel.value = 'نامهٔ حضور در جلسهٔ دفاع';
    kindSel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const li = [...m.querySelectorAll('input.input')]
      .find(i => i.placeholder === 'شمارهٔ نامه');
    li.value = '۹۹۹/۸۸';
    li.dispatchEvent(new Event('input', { bubbles: true }));
    const df = m.querySelector('.date-field input');
    df.value = '1405/04/01';
    df.dispatchEvent(new Event('input', { bubbles: true }));
    df.dispatchEvent(new Event('change', { bubbles: true }));
    df.blur();
    await new Promise(r => setTimeout(r, 200));
    [...m.querySelectorAll('.btn.primary')].pop().click();
  });
  await page.waitForTimeout(1200);

  const synced = await page.evaluate((id) => {
    const r = window.Model.get(id);
    return { no: r.hearingLetterNo, date: r.hearingLetterDate };
  }, caseId);
  check('سند، شمارهٔ نامه و تاریخ را در خودِ پرونده می‌نشاند',
    synced.no === '۹۹۹/۸۸' && synced.date === '14050401', JSON.stringify(synced));

  const shown = await page.evaluate(async () => {
    [...document.querySelectorAll('.tab')]
      .find(t => /جلسه و رأی/.test(t.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const out = {};
    document.querySelectorAll('.form-panel .field').forEach(f => {
      const lab = ((f.querySelector('.field-label') || {}).textContent || '').trim();
      if (/شماره نامه حضور/.test(lab)) out.no = (f.querySelector('input') || {}).value;
      if (/تاریخ نامه حضور/.test(lab)) out.date = (f.querySelector('input') || {}).value;
    });
    return out;
  });
  check('و فرمِ بازِ همان پرونده، همان لحظه نشانشان می‌دهد',
    shown.no === '۹۹۹/۸۸' && shown.date === '1405/04/01', JSON.stringify(shown));

  /* نیمهٔ خطرناک: ذخیره نباید مقدارِ تازه را با خالیِ کهنه بازنویسی کند */
  const afterSave = await page.evaluate(async (id) => {
    const inp = [...document.querySelectorAll('.form-panel .field')]
      .find(f => /موضوع|شماره جلسه|رأی/.test(
        ((f.querySelector('.field-label') || {}).textContent || '')))
      .querySelector('input, textarea');
    inp.value = 'دست‌نوشتهٔ کاربر';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.case-save').click();
    await new Promise(r => setTimeout(r, 800));
    const r = window.Model.get(id);
    return { no: r.hearingLetterNo, date: r.hearingLetterDate };
  }, caseId);
  check('ذخیرهٔ بعدی، مقدارِ هم‌خوان‌شده را پاک نمی‌کند',
    afterSave.no === '۹۹۹/۸۸' && afterSave.date === '14050401',
    JSON.stringify(afterSave));

  /* و برعکس: دست‌نوشتهٔ کاربر هیچ‌وقت با مقدار رکورد بازنویسی نمی‌شود */
  const userWins = await page.evaluate(async (id) => {
    window.App.state.formTab = 'verdict';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 400));
    const f = [...document.querySelectorAll('.form-panel .field')]
      .find(x => /شماره نامه حضور/.test(
        ((x.querySelector('.field-label') || {}).textContent || '')));
    const inp = f.querySelector('input');
    inp.value = 'دست‌نویس';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // چیزی که فرم را دوباره رندر می‌کند، بدون اینکه کاربر ذخیره کرده باشد
    await window.Model.applyPatches([{ id: id, patch: { hearingLetterNo: 'از-بیرون' } }],
      { kind: 'edit', note: 't' });
    [...document.querySelectorAll('.tab')]
      .find(t => /مستندات/.test(t.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    [...document.querySelectorAll('.tab')]
      .find(t => /جلسه و رأی/.test(t.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    const again = [...document.querySelectorAll('.form-panel .field')]
      .find(x => /شماره نامه حضور/.test(
        ((x.querySelector('.field-label') || {}).textContent || '')))
      .querySelector('input').value;
    return again;
  }, caseId);
  check('دست‌نوشتهٔ کاربر با مقدار تازهٔ رکورد بازنویسی نمی‌شود',
    userWins === 'دست‌نویس', userWins);

  // ================================================ بخش‌های اختیاری
  console.log('\n— بخش‌های اختیاری: هر پرونده استعلام یا ارجاع ندارد —');

  const blocks = await page.evaluate(async () => {
    const M = window.Model;
    const r = M.state.cases[1];
    await M.applyPatches([{ id: r.id, patch: {
      securityOutLetterNo: '۵۵۱', securityOutLetterDate: '14050301'
    } }], { kind: 'edit', note: 't' });
    window.App.state.formTab = 'defense';
    window.App.openCase(r.id);
    await new Promise(x => setTimeout(x, 450));
    return {
      id: r.id,
      list: [...document.querySelectorAll('.form-block')]
        .map(n => [n.dataset.block, n.classList.contains('is-off') ? 'جمع' : 'باز']),
      inquiryFields: document.querySelectorAll(
        '[data-block="inquiry"] .field').length,
      defectFields: document.querySelectorAll('[data-block="defect"] .field').length
    };
  });
  check('بخشی که داده دارد باز است و بخشی که ندارد جمع',
    JSON.stringify(blocks.list) ===
    JSON.stringify([['defect', 'جمع'], ['inquiry', 'باز'], ['salaryStop', 'جمع']]),
    JSON.stringify(blocks.list));
  check('فیلدهای بخشِ جمع‌شده اصلاً رندر نمی‌شوند',
    blocks.inquiryFields === 5 && blocks.defectFields === 0,
    blocks.inquiryFields + ' / ' + blocks.defectFields);

  const opened = await page.evaluate(async () => {
    document.querySelector('[data-block="defect"] .btn').click();
    await new Promise(x => setTimeout(x, 300));
    const blk = document.querySelector('[data-block="defect"]');
    return {
      open: !blk.classList.contains('is-off'),
      fields: blk.querySelectorAll('.field').length,
      canCollapse: !!blk.querySelector('.linkish')
    };
  });
  check('با یک کلیک باز می‌شود و دوباره می‌شود جمعش کرد',
    opened.open && opened.fields === 2 && opened.canCollapse, JSON.stringify(opened));

  const staysOpen = await page.evaluate(async (id) => {
    const f = document.querySelector('[data-block="defect"] input');
    f.value = '۷۷۷';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(x => setTimeout(x, 150));
    document.querySelector('.case-save').click();
    await new Promise(x => setTimeout(x, 800));
    window.App.openCase(id);
    await new Promise(x => setTimeout(x, 400));
    const blk = document.querySelector('[data-block="defect"]');
    return { off: blk.classList.contains('is-off'),
      val: (blk.querySelector('input') || {}).value };
  }, blocks.id);
  check('بخشی که پر شد، دفعهٔ بعد خودش باز می‌آید',
    !staysOpen.off && staysOpen.val === '۷۷۷', JSON.stringify(staysOpen));

  // ==================================================== ریل قابل کلیک
  console.log('\n— کلیک روی گرهٔ گردش‌کار، می‌رود سرِ همان فیلد —');

  const railGo = await page.evaluate(async (id) => {
    window.App.state.formTab = 'case';
    window.App.openCase(id);
    await new Promise(x => setTimeout(x, 450));
    const steps = [...document.querySelectorAll('.rail-full .rail-step')];
    const pickable = steps.filter(s => s.classList.contains('pick')).length;
    steps.find(s => /دعوت/.test(s.textContent)).click();
    await new Promise(x => setTimeout(x, 500));
    return {
      pickable: pickable, total: steps.length,
      tab: (document.querySelector('.tab.active') || {}).textContent,
      focused: (document.activeElement.closest('[data-field]') || { dataset: {} })
        .dataset.field,
      flashed: !!document.querySelector('.field-flash')
    };
  }, blocks.id);
  check('همهٔ گره‌های ریل قابل کلیک‌اند',
    railGo.pickable === railGo.total && railGo.total === 18,
    railGo.pickable + ' از ' + railGo.total);
  check('کلیک، تبِ درست را باز می‌کند و فیلد را روشن و فوکوس',
    /دعوت/.test(railGo.tab) && railGo.focused === 'invitationLetterDate' &&
    railGo.flashed, JSON.stringify(railGo));

  const railToBlock = await page.evaluate(async (id) => {
    window.App.state.formTab = 'case';
    window.App.openCase(id);
    await new Promise(x => setTimeout(x, 450));
    [...document.querySelectorAll('.rail-full .rail-step')]
      .find(s => /حضور/.test(s.textContent)).click();
    await new Promise(x => setTimeout(x, 500));
    return {
      block: !!document.querySelector('[data-block="hearingLetter"]:not(.is-off)'),
      focused: (document.activeElement.closest('[data-field]') || { dataset: {} })
        .dataset.field
    };
  }, blocks.id);
  check('گرهٔ یک مرحلهٔ اختیاری، بخش جمع‌شده‌اش را هم باز می‌کند',
    railToBlock.block && railToBlock.focused === 'hearingLetterDate',
    JSON.stringify(railToBlock));

  // ====================================================== به‌روزرسانی
  console.log('\n— دکمهٔ به‌روزرسانی، بدون ورود دوباره —');

  await page.evaluate(FAKE_DISK);
  const refreshed = await page.evaluate(async () => {
    await window.Store.linkFile();
    await window.Store.flushNow();
    const before = window.Model.state.cases.length;
    /* شبیه‌سازی رایانهٔ دیگری که روی همان فایل نوشته است */
    const snap = JSON.parse(window.__disk['parvandeha-db.json']);
    const later = new Date(Date.now() + 600000).toISOString();
    snap.cases.push({ id: 'from-disk-1', caseNo: '7000002',
      firstName: 'تازه', lastName: 'از فایل',
      createdAt: new Date().toISOString(), updatedAt: later });
    snap.lastWriteAt = later;
    window.__disk['parvandeha-db.json'] = JSON.stringify(snap);
    const ok = await window.App.refreshAll(true);
    return {
      ok: ok, before: before, after: window.Model.state.cases.length,
      got: window.Model.state.cases.some(c => c.caseNo === '7000002'),
      stillIn: !document.querySelector('.lock-screen, .start-screen'),
      hasButton: !!document.querySelector('.refresh-btn')
    };
  });
  check('دکمه در نوار بالا هست', refreshed.hasButton);
  check('به‌روزرسانی، فایلِ تازه‌تر روی دیسک را می‌خوانَد',
    refreshed.ok && refreshed.got && refreshed.after === refreshed.before + 1,
    refreshed.before + ' → ' + refreshed.after);
  check('و برنامه قفل نمی‌شود؛ ورود دوباره لازم نیست', refreshed.stillIn);

  /* مهم‌ترین بندِ ترتیب: اول نوشتن، بعد خواندن. وگرنه چیزی که هنوز روی
     فایل ننشسته، با خواندنِ دوباره بلعیده می‌شود. */
  const keepsUnsaved = await page.evaluate(async () => {
    await window.Model.create({ caseNo: '7000003', firstName: 'ذخیره', lastName: 'نشده' });
    const before = window.Model.state.cases.length;
    await window.App.refreshAll(true);
    return {
      before: before, after: window.Model.state.cases.length,
      kept: window.Model.state.cases.some(c => c.caseNo === '7000003')
    };
  });
  check('کارِ نوشته‌نشده با به‌روزرسانی از بین نمی‌رود',
    keepsUnsaved.kept && keepsUnsaved.after >= keepsUnsaved.before,
    keepsUnsaved.before + ' → ' + keepsUnsaved.after);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
