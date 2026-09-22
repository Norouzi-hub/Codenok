/*
 * بستن و باز کردن حقوق، اخراج و تعهد، و خلاصهٔ پرونده.
 *
 * سه چیزِ این دور که همه‌شان یک جنس‌اند: کارِ واقعی دبیرخانه، جایی که
 * برنامه تا امروز جایی برایش نداشت.
 *
 *   ۱) بعضی پرونده‌ها بعد از دعوت اولیه به دفاعیه، نامهٔ بستن حقوق هم
 *      دارند. و اگر رأی تبرئه شد، نامهٔ باز کردن حقوق الزامی است — نه
 *      یک فیلدِ خالیِ اختیاری، بلکه چیزی که کارتابل تا ثبت‌نشدنش دست
 *      برنمی‌دارد، چون حقوق کسی بسته مانده.
 *   ۲) بعد از ابلاغ رأی، یکی اخراج می‌شود و از یکی تعهد گرفته می‌شود.
 *   ۳) خلاصهٔ پرونده: چند خطی که خودِ کارشناس می‌نویسد، سرِ تب «کارها و
 *      یادداشت‌ها».
 *
 * اجرا:  node tools/test/salary.js
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
    viewport: { width: 1440, height: 1000 }, locale: 'fa-IR'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await bootApp(page, APP);

  const id = await page.evaluate(async () => {
    const r = await window.Model.create({
      caseNo: '1405801', status: 'مفتوح رسیدگی',
      firstName: 'زهرا', lastName: 'موسوی',
      intakeDate: '14050101', deliveryDate: '14050103', decreeDate: '14050105',
      invitationLetterDate: '14050110'
    });
    return (r.record || r).id;
  });

  // ================================================== نامهٔ بستن حقوق
  console.log('\n— نامهٔ بستن حقوق، مثل هر نامهٔ دیگر —');

  const block = await page.evaluate(async (recId) => {
    window.App.state.formTab = 'defense';
    window.App.openCase(recId);
    await new Promise(r => setTimeout(r, 450));
    const blk = document.querySelector('[data-block="salaryStop"]');
    return {
      exists: !!blk,
      off: blk && blk.classList.contains('is-off'),
      kindOfField: window.Docs.kindForField('salaryStopLetterDate'),
      inKinds: window.Docs.kinds().indexOf('نامهٔ بستن حقوق') >= 0
    };
  }, id);
  check('بخش «نامهٔ بستن حقوق» در تب دفاعیات هست و تا داده نداشته باشد جمع است',
    block.exists && block.off, JSON.stringify(block));
  check('پشتِ فیلدهایش یک نوع سند واقعی هست',
    block.kindOfField === 'نامهٔ بستن حقوق' && block.inKinds,
    block.kindOfField);

  /* سند که ثبت می‌شود، فیلدهای پرونده را هم پر می‌کند — همان مسیری که
     همهٔ نامه‌های دیگر دارند (applyToCase). */
  const synced = await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    const filled = await window.Docs.applyToCase(rec, {
      kind: 'نامهٔ بستن حقوق', docDate: '14050112', letterNo: '۴۵۶'
    });
    const now = window.Model.get(recId);
    return {
      filled: filled.map(f => f.key),
      date: now.salaryStopLetterDate, no: now.salaryStopLetterNo,
      stage: window.Worklist.stages(now)
        .filter(s => s.key === 'salaryStop')[0]
    };
  }, id);
  check('با ثبت سند، شماره و تاریخ نامهٔ بستن حقوق در پرونده می‌نشیند',
    synced.date === '14050112' && synced.no === '۴۵۶',
    synced.filled.join('، '));
  check('و مرحله‌اش روی ریل گردش‌کار تیک می‌خورد',
    synced.stage && synced.stage.done && synced.stage.date === '14050112',
    JSON.stringify(synced.stage));

  // ================================ تبرئه → نامهٔ باز کردن حقوق الزامی
  console.log('\n— تبرئه که شد، حقوق باید باز شود —');

  const acquitted = await page.evaluate(async (recId) => {
    await window.Model.applyPatches([{ id: recId, patch: {
      defenseReceivedDate: '14050118', docsCompleteDate: '14050120',
      committeeDate: '14050125', verdictDate: '14050126',
      verdictFull: 'تبرئه شد', verdictResult: 'تبرئه',
      verdictSignedDate: '14050202'
    } }], { kind: 'update', note: 'آزمون' });
    const rec = window.Model.get(recId);
    const action = window.Worklist.nextAction(rec);
    window.App.state.formTab = 'enforce';
    window.App.openCase(recId);
    await new Promise(r => setTimeout(r, 450));
    return {
      acquitted: window.Worklist.isAcquitted(rec),
      needs: window.Worklist.needsSalaryResume(rec),
      key: action.key, label: action.label,
      cta: (document.querySelector('.case-cta') || {}).textContent,
      block: !!document.querySelector('[data-block="salaryResume"]')
    };
  }, id);
  check('برنامه می‌فهمد رأی تبرئه است', acquitted.acquitted);
  check('و تا نامهٔ باز کردن حقوق نرود، اقدام بعدیِ پرونده همین است',
    acquitted.key === 'salaryResume' && /باز کردن حقوق/.test(acquitted.label),
    acquitted.label);
  check('دکمهٔ یک‌کلیکی‌اش هم بالای پرونده هست',
    /باز کردن حقوق/.test(acquitted.cta || ''), acquitted.cta);
  check('بخشش در تب «ابلاغ، نتیجه و بایگانی» هست', acquitted.block);

  const resumed = await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    await window.Docs.applyToCase(rec, {
      kind: 'نامهٔ باز کردن حقوق', docDate: '14050204', letterNo: '۹۹۹'
    });
    const now = window.Model.get(recId);
    return {
      date: now.salaryResumeLetterDate,
      needs: window.Worklist.needsSalaryResume(now),
      key: window.Worklist.nextAction(now).key
    };
  }, id);
  check('نامه که ثبت شد، هشدار می‌خوابد و کار جلو می‌رود',
    resumed.date === '14050204' && !resumed.needs && resumed.key === 'notice',
    resumed.key);

  /* پروندهٔ تبرئه، مرحلهٔ «اجرای رأی» ندارد؛ کسی که تبرئه شده نه اخراج
     می‌شود و نه ازش تعهد می‌گیرند. */
  const acquittedEnd = await page.evaluate(async (recId) => {
    const rec = Object.assign({}, window.Model.get(recId), {
      noticeLetterDate: '14050208', noticeResultDate: '14050215'
    });
    return window.Worklist.nextAction(rec).key;
  }, id);
  check('پروندهٔ تبرئه، بعد از نتیجهٔ ابلاغ یک‌راست به بایگانی می‌رسد',
    acquittedEnd === 'archive', acquittedEnd);

  // ============================================ اخراج یا تعهد، بعد از ابلاغ
  console.log('\n— بعد از ابلاغ رأی: یکی اخراج، از یکی تعهد —');

  const convicted = await page.evaluate(async () => {
    const r = await window.Model.create({
      caseNo: '1405802', status: 'مفتوح رسیدگی',
      firstName: 'رضا', lastName: 'کریمی',
      intakeDate: '14050101', deliveryDate: '14050103', decreeDate: '14050105',
      invitationLetterDate: '14050110', defenseReceivedDate: '14050118',
      docsCompleteDate: '14050120', committeeDate: '14050125',
      verdictDate: '14050126', verdictFull: 'کسر حقوق',
      verdictResult: 'محکومیت (صدور تنبیه)', verdictSignedDate: '14050202',
      noticeLetterDate: '14050205', noticeResultDate: '14050215'
    });
    const rec = r.record || r;
    const action = window.Worklist.nextAction(rec);
    window.App.state.formTab = 'enforce';
    window.App.openCase(rec.id);
    await new Promise(x => setTimeout(x, 450));
    return {
      id: rec.id, key: action.key, label: action.label,
      cta: (document.querySelector('.case-cta') || {}).textContent,
      block: !!document.querySelector('[data-block="outcome"]'),
      // بخش «اخراج یا تعهد» ته همان تب می‌نشیند، نه وسط فیلدها
      last: (document.querySelector('.form-panel > *:last-child') || {})
        .dataset.block
    };
  });
  check('محکومیتِ ابلاغ‌شده، تا نتیجهٔ اجرا ثبت نشود تمام نیست',
    convicted.key === 'outcome' && /اخراج یا تعهد/.test(convicted.label),
    convicted.label);
  check('دکمه‌اش همان‌جا بالای پرونده هست',
    /اخراج یا تعهد/.test(convicted.cta || ''), convicted.cta);
  check('بخشش پایین تب «ابلاغ، نتیجه و بایگانی» است',
    convicted.block && convicted.last === 'outcome', convicted.last);

  const outcome = await page.evaluate(async (recId) => {
    const rec = window.Model.get(recId);
    const filled = await window.Docs.applyToCase(rec, {
      kind: 'نامهٔ اخراج', docDate: '14050220', letterNo: '۲۰۲'
    });
    const now = window.Model.get(recId);
    const st = window.Worklist.stages(now).filter(s => s.key === 'outcome')[0];
    return {
      filled: filled.map(f => f.key),
      date: now.dismissalDate, no: now.dismissalLetterNo,
      done: st && st.done, railDate: st && st.date,
      key: window.Worklist.nextAction(now).key
    };
  }, convicted.id);
  check('نامهٔ اخراج که ثبت شد، تاریخ و شماره‌اش در پرونده می‌نشیند',
    outcome.date === '14050220' && outcome.no === '۲۰۲',
    outcome.filled.join('، '));
  check('مرحلهٔ اجرا تیک می‌خورد و نوبت بایگانی می‌شود',
    outcome.done && outcome.railDate === '14050220' && outcome.key === 'archive',
    JSON.stringify(outcome));

  const undertaking = await page.evaluate(async () => {
    const r = await window.Model.create({
      caseNo: '1405803', status: 'مفتوح رسیدگی',
      intakeDate: '14050101', deliveryDate: '14050103', decreeDate: '14050105',
      invitationLetterDate: '14050110', defenseReceivedDate: '14050118',
      docsCompleteDate: '14050120', committeeDate: '14050125',
      verdictDate: '14050126', verdictFull: 'توبیخ',
      verdictSignedDate: '14050202', noticeLetterDate: '14050205',
      noticeResultDate: '14050215'
    });
    const rec = r.record || r;
    await window.Docs.applyToCase(rec, {
      kind: 'تعهدنامهٔ کارمند', docDate: '14050222',
      body: 'تعهد داد که دیگر تکرار نشود'
    });
    const now = window.Model.get(rec.id);
    return {
      date: now.undertakingDate, note: now.undertakingNote,
      key: window.Worklist.nextAction(now).key
    };
  });
  check('تعهدنامه هم همان‌طور ثبت می‌شود، با متن تعهد',
    undertaking.date === '14050222' &&
    /تکرار نشود/.test(undertaking.note || '') && undertaking.key === 'archive',
    JSON.stringify(undertaking));

  // ==================================================== خلاصهٔ پرونده
  console.log('\n— خلاصهٔ پرونده، سرِ تب کارها و یادداشت‌ها —');

  const summary = await page.evaluate(async (recId) => {
    window.App.state.formTab = '__notes';
    window.App.openCase(recId);
    await new Promise(r => setTimeout(r, 450));
    const panel = document.querySelector('.note-panel');
    const box = panel.querySelector('.note-summary');
    return {
      first: panel.firstElementChild === box,
      empty: !!box.querySelector('.note-summary-empty'),
      // سند و تصویر، دیگر اینجا نمایش داده نمی‌شوند
      docs: panel.querySelectorAll('.note-doc').length,
      // ولی راهِ بارگذاری همچنان هست
      upload: !!panel.querySelector('.note-attach-btn')
    };
  }, id);
  check('خلاصه، اولین چیزِ این تب است و تا نوشته نشود، خودش می‌گوید',
    summary.first && summary.empty, JSON.stringify(summary));
  check('سند و تصویر در این تب تکرار نمی‌شوند، ولی بارگذاری ممکن است',
    summary.docs === 0 && summary.upload, JSON.stringify(summary));

  const written = await page.evaluate(async (recId) => {
    document.querySelector('.note-summary .btn').click();
    await new Promise(r => setTimeout(r, 200));
    const area = document.querySelector('.note-summary-input');
    area.value = 'گزارش بازرسی دربارهٔ غیبت مردادماه؛ رأی تبرئه صادر شد.';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.note-summary .btn')]
      .find(b => /ذخیرهٔ خلاصه/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 600));
    return {
      shown: (document.querySelector('.note-summary-text') || {}).textContent,
      saved: window.Model.get(recId).caseSummary,
      inHistory: window.Model.historyFor(recId)
        .some(h => /خلاصهٔ پرونده/.test(h.note || ''))
    };
  }, id);
  check('نوشته می‌شود، ذخیره می‌شود و همان‌جا دیده می‌شود',
    /غیبت مردادماه/.test(written.shown || '') &&
    /غیبت مردادماه/.test(written.saved || ''), written.shown);
  check('تغییرش در تاریخچهٔ پرونده ثبت می‌شود', written.inHistory);

  const reopened = await page.evaluate(async (recId) => {
    window.App.goList();
    await new Promise(r => setTimeout(r, 300));
    window.App.state.formTab = '__notes';
    window.App.openCase(recId);
    await new Promise(r => setTimeout(r, 450));
    return (document.querySelector('.note-summary-text') || {}).textContent;
  }, id);
  check('بعد از بستن و باز کردن پرونده هم سرِ جایش است',
    /غیبت مردادماه/.test(reopened || ''), reopened);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
