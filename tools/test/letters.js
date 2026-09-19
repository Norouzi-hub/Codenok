/*
 * تست ارجاع به کارشناس دیگر، و چهار فرم اداری.
 * اجرا:  node tools/test/letters.js
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await page.waitForSelector('.worklist', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.print = () => {}; });

  // پروندهٔ نمونه با همهٔ چیزهایی که فرم‌ها لازم دارند
  const recId = await page.evaluate(async () => {
    const J = window.J, M = window.Model;
    const c = M.state.cases.slice()
      .sort((a, b) => (a.caseNo || '') < (b.caseNo || '') ? -1 : 1)[0];
    await M.update(c.id, Object.assign({}, c, {
      fatherName: 'محمد', personnelCode: '88123', phone: '09121112233',
      education: 'لیسانس', jobTitle: 'کارشناس امور شهری', servicePlace: 'منطقهٔ ۵',
      priorRecord: 'ندارد', defenseSummary: 'نامبرده اظهار داشت بیمار بوده است.',
      committeeDate: J.addDays(J.today(), -5), committeeRegNo: '1405/ک2/33',
      verdictDate: J.addDays(J.today(), -4),
      verdictFull: 'به توبیخ کتبی با درج در پرونده محکوم می‌گردد.'
    }));
    await M.saveSettings({
      letters: {
        signerName: 'امیریزدی', preparedBy: 'حسین نوروزی', letterheadTop: 45,
        members: [
          { name: 'سید مجتبی حسینی', role: 'نمایندهٔ کارکنان' },
          { name: 'هادی حق‌بین', role: 'نمایندهٔ سرپرستان' },
          { name: 'علی امیریزدی', role: 'نمایندهٔ مدیریت' }
        ],
        cc: ['ادارهٔ کمیتهٔ انضباط کار برای اطلاع.']
      }
    });
    return c.id;
  });

  console.log('\n— ارجاع به کارشناس دیگر —');
  const before = await page.evaluate(() =>
    window.Worklist.summary(window.Model.state.cases));

  await page.evaluate((id) => window.App.openCase(id), recId);
  await page.waitForSelector('.case-transfer');
  await page.evaluate(() => document.querySelector('.case-transfer').click());
  await page.waitForSelector('.transfer');
  await page.waitForTimeout(300);

  const dialog = await page.evaluate(() => ({
    disabled: [...document.querySelectorAll('.modal-foot .btn')].pop().disabled,
    rows: document.querySelectorAll('.transfer-row').length,
    warn: (document.querySelector('.transfer-summary') || {}).textContent || ''
  }));
  check('تا کارشناس مقصد انتخاب نشود، ثبت غیرفعال است',
    dialog.disabled && /کارشناس مقصد/.test(dialog.warn));
  check('پرونده در فهرست پنجره دیده می‌شود', dialog.rows === 1);

  await page.evaluate(() => {
    const s = document.querySelector('.transfer-head select');
    s.value = '__new';
    s.dispatchEvent(new Event('change'));
    const i = document.querySelectorAll('.transfer-head input')[0];
    i.value = 'کمیتهٔ منطقهٔ ۵';
    i.dispatchEvent(new Event('input'));
    const reason = document.querySelector('.transfer-head textarea');
    reason.value = 'خارج از صلاحیت این کمیته';
    reason.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() =>
    [...document.querySelectorAll('.modal-foot .btn')].pop().click());
  await page.waitForSelector('.overlay:last-of-type .btn.danger');
  await page.waitForTimeout(300);
  await page.evaluate(() =>
    document.querySelector('.overlay:last-of-type .btn.danger').click());
  await page.waitForTimeout(900);

  const after = await page.evaluate((id) => {
    const c = window.Model.get(id);
    const h = window.Model.historyFor(id);
    return {
      summary: window.Worklist.summary(window.Model.state.cases),
      to: c.transferTo, from: c.transferFrom, date: c.transferDate,
      reason: c.transferReason, status: c.status,
      action: window.Worklist.nextAction(c).key,
      transferred: window.Worklist.isTransferred(c),
      closed: window.Worklist.isClosed(c),
      banner: !!document.querySelector('.case-next.transferred'),
      lastKind: h[h.length - 1].kind,
      inBuckets: window.Worklist.buckets(window.Model.state.cases)
        .some(b => b.items.some(i => i.rec.id === id))
    };
  }, recId);

  check('ارجاع با تاریخ، مقصد، کارشناس قبلی و علت ثبت می‌شود',
    after.to === 'کمیتهٔ منطقهٔ ۵' && !!after.date && !!after.from &&
    /خارج از صلاحیت/.test(after.reason || ''),
    JSON.stringify({ to: after.to, from: after.from }));
  check('پرونده از کارتابل بیرون می‌رود', !after.inBuckets && after.action === 'transferred');
  check('ارجاع‌شده «مختومه» شمرده نمی‌شود', after.transferred && !after.closed);
  check('شمارش‌ها درست جابه‌جا می‌شوند',
    after.summary.open === before.open - 1 &&
    after.summary.transferred === before.transferred + 1 &&
    after.summary.closed === before.closed,
    'باز ' + before.open + '→' + after.summary.open +
    '، ارجاع‌شده ' + after.summary.transferred);
  check('بالای پرونده، وضعیت ارجاع نشان داده می‌شود', after.banner);
  check('رویداد ارجاع در تاریخچه می‌نشیند', after.lastKind === 'transfer');

  // در گزارش هم نه «باز» است و نه «مختومه»
  const inReport = await page.evaluate(() => {
    const k = window.Report.kpis(window.Model.state.cases);
    return { open: k.open, closed: k.closed, transferred: k.transferred, total: k.total };
  });
  check('گزارش‌ها ارجاع‌شده را جدا می‌شمارند',
    inReport.transferred === 1 &&
    inReport.open + inReport.closed + inReport.transferred === inReport.total,
    JSON.stringify(inReport));

  // برگرداندن
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.case-next.transferred .btn')];
    btns[0].click();
  });
  await page.waitForSelector('.overlay:last-of-type .btn.danger');
  await page.waitForTimeout(300);
  await page.evaluate(() =>
    document.querySelector('.overlay:last-of-type .btn.danger').click());
  await page.waitForTimeout(800);
  const undone = await page.evaluate((id) => {
    const c = window.Model.get(id);
    return {
      transferred: window.Worklist.isTransferred(c),
      open: window.Worklist.summary(window.Model.state.cases).open
    };
  }, recId);
  check('ارجاع اشتباه قابل برگرداندن است',
    !undone.transferred && undone.open === before.open, JSON.stringify(undone));

  console.log('\n— فرم‌های اداری —');
  await page.evaluate((id) => window.App.openCase(id), recId);
  await page.waitForSelector('.case-forms');
  await page.evaluate(() => document.querySelector('.case-forms').click());
  await page.waitForSelector('.sheet');
  await page.waitForTimeout(300);
  const forms = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet-item .sheet-text b')].map(b => b.textContent));
  check('هر چهار فرم در فهرست هستند',
    forms.length === 4 && forms.indexOf('خلاصهٔ پرونده') >= 0 &&
    forms.indexOf('رأی صادره') >= 0 && forms.indexOf('ابلاغ رأی') >= 0,
    forms.join(' | '));
  await page.evaluate(() => document.querySelector('.sheet-close').click());
  await page.waitForTimeout(200);

  const extra = {
    service: '۱۲ سال', serviceFrom: '۱۳۹۲/۰۳/۰۱', serviceTo: '۱۴۰۵/۰۶/۲۸',
    company: 'موسسه هادیان شهر', addressee: 'رضایی',
    addresseeRole: 'شهردار محترم منطقهٔ ۵', outLetterNo: '۱۴۰۵/۳۱۱/م'
  };

  // ۱) خلاصهٔ پرونده — روی کاغذ سفید
  const summary = await page.evaluate(({ id, extra }) => {
    window.UILetters.printSummary(window.Model.get(id), extra);
    const rows = [...document.querySelectorAll('#print-area .lf-summary tr')];
    return {
      plain: !!document.querySelector('#print-area .lf-plain'),
      head: !!document.querySelector('#print-area .lf-head-space'),
      title: (document.querySelector('#print-area .lf-title') || {}).textContent,
      labels: rows.map(r => r.querySelector('th').textContent),
      values: rows.map(r => r.querySelector('td').textContent)
    };
  }, { id: recId, extra });
  check('فرم خلاصهٔ پرونده روی کاغذ سفید ساخته می‌شود',
    summary.plain && !summary.head && summary.title === 'خلاصهٔ پرونده');
  check('یازده سطر نمونه، با همان ترتیب فرم شما',
    summary.labels.length === 11 &&
    summary.labels[0] === 'نام' &&
    summary.labels[5] === 'سابقهٔ کار در شهرداری' &&
    summary.labels[10] === 'خلاصهٔ دفاعیه',
    summary.labels.join('/'));
  check('مقدارها از خود پرونده پر می‌شوند',
    /لیسانس/.test(summary.values.join(' ')) &&
    /۱۲ سال/.test(summary.values.join(' ')) &&
    /بیمار/.test(summary.values.join(' ')));

  // ۲) تفهیم اتهام و دفاعیه
  const defense = await page.evaluate(({ id, extra }) => {
    window.UILetters.printDefense(window.Model.get(id), extra);
    const t = document.getElementById('print-area').textContent;
    return {
      plain: !!document.querySelector('#print-area .lf-plain'),
      title: (document.querySelector('#print-area .lf-title') || {}).textContent,
      blank: !!document.querySelector('#print-area .lf-blank'),
      signRow: (document.querySelector('#print-area .lf-sign-row') || {}).textContent || '',
      hasService: /۱۲ سال/.test(t)
    };
  }, { id: recId, extra });
  check('فرم تفهیم اتهام با جای خالی دفاعیه ساخته می‌شود',
    defense.plain && defense.title === 'فرم تفهیم اتهام و دفاعیه' && defense.blank);
  check('پای فرم، نام و امضا و تاریخ دارد',
    /امضاء/.test(defense.signRow) && /تاریخ/.test(defense.signRow));
  check('سابقهٔ کار در فرم می‌نشیند', defense.hasService);

  // ۳) رأی صادره — روی سربرگ
  const verdict = await page.evaluate(({ id, extra }) => {
    window.UILetters.printVerdict(window.Model.get(id), extra);
    const t = document.getElementById('print-area').textContent;
    const space = document.querySelector('#print-area .lf-head-space');
    return {
      space: space ? space.style.height : '',
      mark: (document.querySelector('#print-area .lf-verdict-mark') || {}).textContent,
      members: document.querySelectorAll('#print-area .lf-member').length,
      notice: document.querySelectorAll('#print-area .lf-notice-row').length,
      hasVerdict: /توبیخ کتبی/.test(t),
      hasFinal: /قطعی و لازم‌الاجرا/.test(t),
      hasRegulation: /۱۴۰۲\/۰۵\/۰۸/.test(t),
      persianId: /۱۲۳۴۵۶۷۸۹۰/.test(t)
    };
  }, { id: recId, extra });
  check('فرم رأی روی سربرگ ساخته می‌شود و بالای صفحه خالی می‌ماند',
    verdict.space === '45mm' && /رأی صادره/.test(verdict.mark), verdict.space);
  check('متن رأی، جملهٔ قطعیت و مستند آیین‌نامه در فرم هست',
    verdict.hasVerdict && verdict.hasFinal && verdict.hasRegulation);
  check('اعضای کمیته و بخش ابلاغ پای فرم می‌آیند',
    verdict.members === 3 && verdict.notice === 3,
    verdict.members + ' عضو، ' + verdict.notice + ' سطر ابلاغ');
  check('در فرم رسمی، ارقام فارسی نوشته می‌شوند', verdict.persianId);

  // ۴) ابلاغ رأی
  const notice = await page.evaluate(({ id, extra }) => {
    window.UILetters.printNotice(window.Model.get(id), extra);
    const t = document.getElementById('print-area').textContent;
    return {
      space: (document.querySelector('#print-area .lf-head-space') || {}).style.height,
      to: (document.querySelector('#print-area .lf-to') || {}).textContent || '',
      quote: (document.querySelector('#print-area .lf-quote') || {}).textContent || '',
      signer: (document.querySelector('#print-area .lf-signer') || {}).textContent || '',
      cc: document.querySelectorAll('#print-area .lf-cc-list li').length,
      prepared: /حسین نوروزی/.test(t),
      hasLetterNo: /۱۴۰۵\/۳۱۱/.test(t),
      hasSession: /مطرح و منتج به صدور رأی/.test(t)
    };
  }, { id: recId, extra });
  check('نامهٔ ابلاغ روی سربرگ، با مخاطب و موضوع ساخته می‌شود',
    notice.space === '45mm' && /رضایی/.test(notice.to) &&
    /ابلاغ رأی کمیتهٔ انضباط کار/.test(notice.to));
  check('متن رأی داخل گیومه در نامه می‌آید', /توبیخ کتبی/.test(notice.quote));
  check('امضاکننده، رونوشت‌ها و تهیه‌کننده می‌نشینند',
    /امیریزدی/.test(notice.signer) && notice.cc === 1 && notice.prepared,
    notice.cc + ' رونوشت');
  check('شمارهٔ نامهٔ صادره و ارجاع به جلسه در متن هست',
    notice.hasLetterNo && notice.hasSession);

  console.log('\n— تنظیمات سربرگ —');
  await page.evaluate(() => window.UIMisc.settingsDialog(window.App));
  await page.waitForSelector('.letters-settings');
  const settings = await page.evaluate(() => ({
    fields: document.querySelectorAll('.letters-settings .field').length,
    members: document.querySelectorAll('.member-row').length,
    topValue: document.querySelector('.letters-settings input[type=number]').value
  }));
  check('تنظیمات سربرگ، امضاکننده و اعضا در دسترس است',
    settings.fields === 5 && settings.members === 3 && settings.topValue === '45',
    JSON.stringify(settings));

  await page.evaluate(() => {
    document.querySelector('.letters-settings input[type=number]').value = '60';
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
  });
  await page.waitForTimeout(700);
  const applied = await page.evaluate((id) => {
    window.UILetters.printVerdict(window.Model.get(id), {});
    return {
      conf: window.UILetters.conf().letterheadTop,
      space: (document.querySelector('#print-area .lf-head-space') || {}).style.height
    };
  }, recId);
  check('تغییر اندازهٔ سربرگ روی فرم اثر می‌گذارد',
    applied.conf === 60 && applied.space === '60mm', JSON.stringify(applied));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
