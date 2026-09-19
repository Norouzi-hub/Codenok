/*
 * تست ارجاع به کارشناس دیگر، و چهار فرم اداری.
 * اجرا:  node tools/test/letters.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW || 'playwright');

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'letters-'));

/* فایل docx یک ZIP است؛ بدون کتابخانه بازش می‌کنیم تا مطمئن شویم واقعاً
   فایل ورد است، نه HTML با پسوند عوضی. */
function unzip(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { maxBuffer: 1 << 24 })
    .toString('utf8');
}

/* ------------------------------------------------------------------
   ترتیب عناصر در OOXML اختیاری نیست: طرح‌وارهٔ ECMA-376 «توالی» است و ورد
   اگر jc را قبل از spacing ببیند، فایل را خراب اعلام می‌کند و اصلاً باز
   نمی‌کند. خوش‌ساخت‌بودن XML کافی نیست، پس ترتیب را خودمان می‌سنجیم.
   فهرست‌ها فقط همان عناصری را دارند که این برنامه می‌نویسد. */
const SEQ = {
  'w:pPr': ['w:pBdr', 'w:bidi', 'w:spacing', 'w:ind', 'w:jc'],
  'w:rPr': ['w:rFonts', 'w:b', 'w:bCs', 'w:sz', 'w:szCs', 'w:rtl'],
  'w:tcPr': ['w:tcW', 'w:gridSpan', 'w:vAlign'],
  'w:tblPr': ['w:bidiVisual', 'w:tblW', 'w:tblBorders', 'w:tblCellMar'],
  'w:tblBorders': ['w:top', 'w:start', 'w:left', 'w:bottom', 'w:end', 'w:right',
    'w:insideH', 'w:insideV'],
  'w:tblCellMar': ['w:top', 'w:start', 'w:bottom', 'w:end'],
  'w:tbl': ['w:tblPr', 'w:tblGrid', 'w:tr'],
  'w:sectPr': ['w:pgSz', 'w:pgMar', 'w:bidi'],
  'w:docDefaults': ['w:rPrDefault', 'w:pPrDefault']
};

/** درخت سبک XML: فقط تگ و فرزندان، چیز دیگری لازم نیست */
function parse(xml) {
  const root = { tag: '#root', kids: [] };
  const stack = [root];
  const tag = /<(\/?)([\w:]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(xml))) {
    if (m[2] === '?xml') continue;
    const node = { tag: m[2], kids: [] };
    if (m[1]) stack.pop();
    else if (m[4]) stack[stack.length - 1].kids.push(node);
    else { stack[stack.length - 1].kids.push(node); stack.push(node); }
  }
  return root;
}

/** هر جایی که ترتیبش را می‌شناسیم، بررسی می‌کند فرزندان پس‌وپیش نشده باشند */
function orderErrors(xml) {
  const bad = [];
  (function walk(n) {
    const order = SEQ[n.tag];
    if (order) {
      let last = -1;
      n.kids.forEach(k => {
        const i = order.indexOf(k.tag);
        if (i < 0) bad.push(n.tag + ' > ' + k.tag + ' (ناشناخته)');
        else if (i < last) bad.push(n.tag + ' > ' + k.tag + ' (جابه‌جا)');
        else last = i;
      });
    }
    n.kids.forEach(walk);
  })(parse(xml));
  return [...new Set(bad)];
}

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
  // «ارجاع» حالا پشت «⋯» است، کنار چاپ و حذف — نوار بالا کوتاه‌تر شده
  await page.waitForSelector('.case-more');
  await page.evaluate(() => document.querySelector('.case-more').click());
  await page.waitForSelector('.sheet');
  await page.evaluate(() => {
    [...document.querySelectorAll('.sheet-item')]
      .filter(b => /ارجاع به کارشناس دیگر/.test(b.textContent))[0].click();
  });
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
    const wrap = document.querySelector('#print-area .lf');
    return {
      head: !!document.querySelector('#print-area .lf-letterhead'),
      space: (document.querySelector('#print-area .lf-head-space') || {}).style.height,
      side: wrap ? wrap.style.paddingInlineEnd : '',
      title: (document.querySelector('#print-area .lf-title') || {}).textContent,
      blank: !!document.querySelector('#print-area .lf-blank'),
      signRow: (document.querySelector('#print-area .lf-sign-row') || {}).textContent || '',
      hasService: /۱۲ سال/.test(t)
    };
  }, { id: recId, extra });
  check('فرم تفهیم اتهام با جای خالی دفاعیه ساخته می‌شود',
    defense.title === 'فرم تفهیم اتهام و دفاعیه' && defense.blank);
  // ۲۵ میلی‌متر از لبهٔ راست، منهای ۱۲ میلی‌متر حاشیهٔ خود کاغذ
  check('تفهیم اتهام هم روی سربرگ است و از راست فاصله می‌گیرد',
    defense.head && defense.space === '31mm' && defense.side === '13mm',
    defense.space + ' / ' + defense.side);
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
  // تنظیم ۴۵ میلی‌متر «از لبهٔ کاغذ» است و خود کاغذ ۱۴ میلی‌متر حاشیه دارد،
  // پس فضای افزوده ۳۱ میلی‌متر می‌شود — جمعاً همان ۴۵.
  check('فرم رأی روی سربرگ ساخته می‌شود و بالای صفحه خالی می‌ماند',
    verdict.space === '31mm' && /رأی صادره/.test(verdict.mark), verdict.space);
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
    notice.space === '31mm' && /رضایی/.test(notice.to) &&
    /ابلاغ رأی کمیتهٔ انضباط کار/.test(notice.to));
  check('متن رأی داخل گیومه در نامه می‌آید', /توبیخ کتبی/.test(notice.quote));
  check('امضاکننده، رونوشت‌ها و تهیه‌کننده می‌نشینند',
    /امیریزدی/.test(notice.signer) && notice.cc === 1 && notice.prepared,
    notice.cc + ' رونوشت');
  check('شمارهٔ نامهٔ صادره و ارجاع به جلسه در متن هست',
    notice.hasLetterNo && notice.hasSession);

  // ------------------------------------------------------------ خروجی ورد
  console.log('\n— خروجی ورد —');

  /** فرم را با دکمهٔ واقعیِ برنامه در ورد می‌گیرد و فایل را برمی‌گرداند */
  async function word(kind, form) {
    await page.evaluate(({ id, k }) => {
      const rec = window.Model.get(id);
      const f = window.UILetters.FORMS.filter(x => x.key === k)[0];
      window.UILetters.formDialog(window.App, rec, f);
    }, { id: recId, k: kind });
    await page.waitForSelector('.letters-modal');
    await page.waitForTimeout(150);
    const dl = page.waitForEvent('download', { timeout: 15000 });
    await page.evaluate(() => {
      [...document.querySelectorAll('.modal-foot .btn')]
        .filter(b => b.textContent === 'خروجی ورد')[0].click();
    });
    const d = await dl;
    const file = path.join(OUT, kind + '.docx');
    await d.saveAs(file);
    return { file, name: d.suggestedFilename() };
  }

  const docs = {};
  for (const k of ['summary', 'defense', 'verdict', 'notice']) {
    docs[k] = await word(k);
    await page.waitForTimeout(200);
  }

  // نام فایل لاتین است چون کروم روی  file://  نام فارسی را دور می‌ریزد
  check('هر چهار فرم فایل ورد می‌دهند، با نام پرونده روی فایل',
    Object.keys(docs).length === 4 &&
    Object.keys(docs).every(k => fs.existsSync(docs[k].file) &&
      /^[\x20-\x7E]+\.docx$/.test(docs[k].name)) &&
    /^ray-/.test(docs.verdict.name) && /^eblagh-ray-/.test(docs.notice.name),
    Object.keys(docs).map(k => docs[k].name).join(' | '));

  const zipList = execFileSync('unzip', ['-l', docs.verdict.file]).toString();
  check('فایل واقعاً بستهٔ ورد است، نه HTML با پسوند عوضی',
    /word\/document\.xml/.test(zipList) && /\[Content_Types\]\.xml/.test(zipList) &&
    /word\/styles\.xml/.test(zipList));

  const vx = unzip(docs.verdict.file, 'word/document.xml');
  check('XML سالم است و متن فارسیِ فرم داخلش هست',
    /^<\?xml/.test(vx) && vx.trim().endsWith('</w:document>') &&
    vx.indexOf('توبیخ کتبی') > 0 && vx.indexOf('رأی صادره') > 0);
  check('راست‌به‌چپ در هر سه جا اعلام شده: پاراگراف، متن، جدول',
    /<w:bidi\/>/.test(vx) && /<w:rtl\/>/.test(vx) && /<w:bidiVisual\/>/.test(vx));

  const orderBad = [];
  for (const k of Object.keys(docs)) {
    for (const part of ['word/document.xml', 'word/styles.xml']) {
      orderErrors(unzip(docs[k].file, part)).forEach(e =>
        orderBad.push(k + ' ' + part.split('/')[1] + ': ' + e));
    }
  }
  check('ترتیب عناصر با طرح‌وارهٔ ورد می‌خواند (وگرنه ورد فایل را باز نمی‌کند)',
    orderBad.length === 0, orderBad.slice(0, 5).join(' | '));
  check('اعضای کمیته و بخش ابلاغ در فایل ورد هم هستند',
    vx.indexOf('هادی حق‌بین') > 0 && vx.indexOf('مأمور ابلاغ') > 0);

  const sx = unzip(docs.summary.file, 'word/document.xml');
  check('خلاصهٔ پرونده در ورد، همان یازده سطر جدول را دارد',
    (sx.match(/<w:tr>/g) || []).length === 11 && sx.indexOf('خلاصهٔ دفاعیه') > 0,
    (sx.match(/<w:tr>/g) || []).length + ' سطر');

  /** حاشیهٔ صفحه در ورد، از twip به میلی‌متر */
  function margins(xml) {
    const attrs = /<w:pgMar ([^>]*)\/>/.exec(xml)[1];
    const mm = k =>
      Math.round(Number(new RegExp('w:' + k + '="(\\d+)"').exec(attrs)[1]) / 56.6929);
    return { top: mm('top'), right: mm('right'), bottom: mm('bottom'), left: mm('left') };
  }
  const vm = margins(vx);
  check('در ورد، سربرگ از بالا و از راست فاصله می‌گیرد',
    vm.top === 45 && vm.right === 25 && vm.left === 12, JSON.stringify(vm));
  const sm = margins(sx);
  check('کاغذ سفید حاشیهٔ معمولی دارد، نه حاشیهٔ سربرگ',
    sm.top === 16 && sm.right === 12 && sm.left === 12, JSON.stringify(sm));

  const dm = margins(unzip(docs.defense.file, 'word/document.xml'));
  check('تفهیم اتهام در ورد هم روی سربرگ می‌نشیند',
    dm.top === 45 && dm.right === 25, JSON.stringify(dm));

  console.log('\n— تنظیمات سربرگ —');
  await page.evaluate(() => window.UIMisc.settingsDialog(window.App));
  await page.waitForSelector('.letters-settings');
  const settings = await page.evaluate(() => {
    const nums = [...document.querySelectorAll('.letters-settings input[type=number]')];
    return {
      fields: document.querySelectorAll('.letters-settings .field').length,
      members: document.querySelectorAll('.member-row').length,
      nums: nums.map(n => n.value)
    };
  });
  check('فاصلهٔ بالا و فاصلهٔ راستِ سربرگ، هر دو قابل تنظیم‌اند',
    settings.fields === 6 && settings.members === 3 &&
    settings.nums.join(',') === '45,25', JSON.stringify(settings));

  await page.evaluate(() => {
    const nums = [...document.querySelectorAll('.letters-settings input[type=number]')];
    nums[0].value = '60';
    nums[1].value = '32';
    [...document.querySelectorAll('.modal-foot .btn')].pop().click();
  });
  await page.waitForTimeout(700);
  const applied = await page.evaluate((id) => {
    window.UILetters.printVerdict(window.Model.get(id), {});
    const c = window.UILetters.conf();
    return {
      top: c.letterheadTop, right: c.letterheadRight,
      space: (document.querySelector('#print-area .lf-head-space') || {}).style.height,
      side: (document.querySelector('#print-area .lf') || {}).style.paddingInlineEnd
    };
  }, recId);
  check('تغییر اندازهٔ سربرگ روی چاپ اثر می‌گذارد',
    applied.top === 60 && applied.right === 32 &&
    applied.space === '46mm' && applied.side === '20mm', JSON.stringify(applied));

  const reWord = await word('verdict');
  const am = margins(unzip(reWord.file, 'word/document.xml'));
  check('همان تغییر روی خروجی ورد هم می‌نشیند',
    am.top === 60 && am.right === 32, JSON.stringify(am));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
