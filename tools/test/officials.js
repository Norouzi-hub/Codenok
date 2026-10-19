/*
 * دفتر مقامات — نامِ مخاطب در مینوت.
 *
 *   ۱) سمت‌ها با هر نوشتنی جور می‌شوند: «منطقه پنج» = «منطقهٔ ۵» = «منطقه 05»،
 *      «شهرداری منطقه …» = «منطقه …»؛ ولی «منطقه ۱» با «منطقه ۱۲» نه.
 *   ۲) اکسل با چند شکلِ سرستون خوانده می‌شود (نام جدا/یکجا، سمت و واحد
 *      جدا/یکجا، «خانم» جلوی نام، ستونِ جنسیت).
 *   ۳) مینوت: «جناب آقای … شهردار محترم منطقه ۵»؛ با تیکِ «نام مخاطب» خاموش، فقط سمت.
 *   ۴) هر کسِ دفتر می‌تواند گیرنده باشد، با رتبه و فعلِ درست.
 *   ۵) فهرستِ تازه: فرقش پیش از جایگزینی گفته می‌شود و در «آخرین جابه‌جایی‌ها» می‌ماند.
 *
 * همهٔ نام‌ها ساختگی‌اند.
 * اجرا:  node tools/test/officials.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/nokman/index.html');
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
  const page = await (await browser.newContext({ locale: 'fa-IR', viewport: { width: 1360, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await bootApp(page, APP);

  // ============================================================== کلید
  console.log('— جور شدنِ سمت‌ها —');
  const k = await page.evaluate(() => {
    const O = window.Officials;
    return {
      a: O.key('شهردار محترم منطقه پنج') === O.key('شهردار منطقهٔ ۵') && O.key('شهردار منطقه 05') === O.key('شهردار منطقه ۵'),
      b: O.key('معاون محترم مالی و اداری شهرداری منطقه پنج') === O.key('معاون مالی و اداری منطقه ۵'),
      c: O.key('شهردار منطقه بیست و دو') === O.key('شهردار منطقه ۲۲'),
      d: O.key('شهردار منطقه ۱') !== O.key('شهردار منطقه ۱۲'),
      e: O.key('مدير عامل شركت خدمات') === O.key('مدیر عامل شرکت خدمات'),
      t1: O.honorTitle('شهردار', 'منطقه 5'),
      t2: O.honorTitle('مدیر عامل', 'سازمان پارک‌ها و فضای سبز'),
      t3: O.honorTitle('معاون مالی و اداری', 'منطقه ۵'),
      t4: O.honorTitle('معاون شهردار تهران', '')
    };
  });
  check('«منطقه پنج» = «منطقهٔ ۵» = «منطقه 05»', k.a);
  check('«معاون … شهرداری منطقه پنج» = «معاون … منطقه ۵»', k.b);
  check('«بیست و دو» = ۲۲، و «منطقه ۱» ≠ «منطقه ۱۲»', k.c && k.d);
  check('«ي/ك»ِ عربی در فایل مانعِ جور شدن نیست', k.e);
  check('«محترم» سرِ جایش: بعد از سمت، پیش از واحد',
    k.t1 === 'شهردار محترم منطقه ۵' && k.t2 === 'مدیرعامل محترم سازمان پارک‌ها و فضای سبز' &&
    k.t3 === 'معاون محترم مالی و اداری منطقه ۵' && k.t4 === 'معاون محترم شهردار تهران',
    [k.t1, k.t2, k.t3, k.t4].join(' | '));

  // ============================================================== اکسل
  console.log('\n— خواندنِ اکسل —');
  const xl = await page.evaluate(async () => {
    const O = window.Officials, X = window.XLSX;
    async function roundtrip(rows) {
      const blob = X.build([{ name: 'S', rows }]);
      return X.read(await blob.arrayBuffer());
    }
    // شکلِ ۱: نام یکجا، سمت و واحد جدا، با یک سطرِ عنوان بالای جدول
    const r1 = await roundtrip([
      ['فهرست مدیران — ساختگی'],
      ['ردیف', 'نام و نام خانوادگی', 'سمت', 'واحد'],
      ['1', 'آرش نمونه‌ای', 'شهردار', 'منطقه ۵'],
      ['2', 'خانم مهتاب آزمایشی', 'معاون مالی و اداری', 'شهرداری منطقه پنج'],
      ['3', 'دکتر بهرام ساختگی', 'مدیر عامل', 'سازمان پارک‌ها و فضای سبز'],
      ['4', 'کاوه فرضی', 'مدیرعامل', 'شرکت خدمات اداری شهر'],
      ['', '', '', '']
    ]);
    const d1 = O.detect(r1);
    const p1 = O.parse(r1, d1.header, d1.map);
    // شکلِ ۲: نام و نام خانوادگی جدا، سمت و واحد در یک ستون، ستونِ جنسیت
    const r2 = await roundtrip([
      ['نام', 'نام خانوادگی', 'عنوان پست', 'جنسیت'],
      ['سارا', 'نمونه', 'شهردار منطقه ۱۲', 'زن'],
      ['نادر', 'آزمونی', 'معاون شهردار تهران', 'مرد']
    ]);
    const d2 = O.detect(r2);
    const p2 = O.parse(r2, d2.header, d2.map);
    return {
      h1: d1.header, m1: d1.map, a1: p1.map(o => O.address(o)), r1: p1.map(o => o.rank),
      h2: d2.header, a2: p2.map(o => O.address(o)), r2: p2.map(o => o.rank)
    };
  });
  check('سرستون زیرِ سطرِ عنوان هم پیدا می‌شود', xl.h1 === 1 && xl.m1.name === 1 && xl.m1.position === 2 && xl.m1.org === 3,
    JSON.stringify(xl.m1));
  check('شکلِ ۱: «جناب آقای … شهردار محترم منطقه ۵»، «سرکار خانم …»، «دکتر» می‌ماند',
    xl.a1[0] === 'جناب آقای آرش نمونه‌ای شهردار محترم منطقه ۵' &&
    xl.a1[1] === 'سرکار خانم مهتاب آزمایشی معاون محترم مالی و اداری منطقه پنج' &&
    xl.a1[2] === 'جناب آقای دکتر بهرام ساختگی مدیرعامل محترم سازمان پارک‌ها و فضای سبز' && xl.a1.length === 4,
    xl.a1.join(' | '));
  check('رتبهٔ پیشنهادی: شهردار بالادست، مدیرعاملِ شرکت پایین‌دست، بقیه همتراز',
    xl.r1.join() === 'high,peer,peer,low', xl.r1.join());
  check('شکلِ ۲: نامِ جدا، سمت و واحدِ یکجا، جنسیت', xl.h2 === 0 &&
    xl.a2[0] === 'سرکار خانم سارا نمونه شهردار محترم منطقه ۱۲' &&
    xl.a2[1] === 'جناب آقای نادر آزمونی معاون محترم شهردار تهران' && xl.r2[1] === 'high', xl.a2.join(' | '));

  // شکلِ ۳: فهرستِ رسمی — «نام واحد» و یک ستونِ «نام و نام خانوادگی، عناوین» با سطرِ کامل
  const xl3 = await page.evaluate(async () => {
    const O = window.Officials, X = window.XLSX;
    const rows = await X.read(await X.build([{ name: 'S', rows: [
      ['ردیف', 'نام واحد', 'نام و نام خانوادگی ، عناوین '],
      ['', 'حوزه شهردار ', ''],
      ['1', 'اداره کل نمونه', 'جناب آقای آرمان فرضی مدیرکل محترم امور نمونه '],
      ['2', 'سازمان آزمون', 'جناب آقای بیژن ساختگی جانشین محترم شهردار و رئيس سازمان آزمون'],
      ['3', 'شرکت خدمات اداری شهر', 'جناب آقای کامران نمونه سرپرست محترم و نايب رئيس هيئت مديره شركت خدمات اداري شهر'],
      ['4', 'موسسه آموزشی نمونه', 'سرپرست محترم موسسه آموزشی نمونه'],
      ['5', 'اداره کل ترافیک نمونه', 'سرکا رخانم نسیم آزمایشی مدیرکل محترم ترافیک'],
      ['', 'شهرداری های مناطق', ''],
      ['5', 'شهرداری منطقه 05', 'جناب اقای پیمان نمونه‌ای شهردار محترم '],
      ['13', 'شهرداري  منطقه 13', 'سرکار خانم ژاله فرضی شهردار محترم']
    ] }]).arrayBuffer());
    const d = O.detect(rows);
    const list = O.parse(rows, d.header, d.map);
    const saved = O.list().slice();
    await O.setList(list);
    const MN = window.Minute;
    const R = id => MN.conf().recipients.find(r => r.id === id);
    const rec = { servicePlace: 'شهرداری منطقه پنج', firstName: 'ا', lastName: 'ب' };
    const out = {
      n: list.length, a: list.map(o => O.address(o)), names: list.map(o => o.name), ranks: list.map(o => o.rank),
      mayor: MN.build('invite', [rec], { recipient: R('mayor') }).to,
      khad: MN.build('invite', [rec], { recipient: R('khadamat') }).to,
      region: MN.build('invite', [rec], { recipient: R('region') }).to
    };
    await O.setList(saved);
    return out;
  });
  check('شکلِ ۳ (فهرستِ رسمی): سطرهای عنوانِ بخش کنار می‌روند', xl3.n === 7, String(xl3.n));
  check('سطرِ کامل همان‌طور که نوشته شده، با «ی/ک» فارسی',
    xl3.a[0] === 'جناب آقای آرمان فرضی مدیرکل محترم امور نمونه' &&
    xl3.a[2] === 'جناب آقای کامران نمونه سرپرست محترم و نایب رئیس هیئت مدیره شرکت خدمات اداری شهر', xl3.a.join(' | '));
  check('«جانشین محترم …»: سمت از نام جداست', xl3.names[1] === 'بیژن ساختگی' && xl3.ranks[1] === 'high', xl3.names[1]);
  check('پستِ بی‌نام فقط عنوان است', xl3.names[3] === '' && xl3.a[3] === 'سرپرست محترم موسسه آموزشی نمونه');
  check('«سرکا رخانم» و «جناب اقای» درست خوانده می‌شوند',
    /^سرکار خانم نسیم آزمایشی/.test(xl3.a[4]) && /^جناب آقای پیمان نمونه‌ای/.test(xl3.a[5]));
  check('«شهردار محترم» + «شهرداری منطقه 05» ← «شهردار محترم منطقه ۵»',
    xl3.a[5] === 'جناب آقای پیمان نمونه‌ای شهردار محترم منطقه ۵' && xl3.a[6] === 'سرکار خانم ژاله فرضی شهردار محترم منطقه ۱۳', xl3.a[6]);
  check('مینوت: شهردارِ منطقهٔ پرونده پیدا می‌شود', xl3.mayor === 'جناب آقای پیمان نمونه‌ای شهردار محترم منطقه ۵', xl3.mayor);
  check('نامه به «مدیرعامل … شرکت خدمات» به سرپرستِ فعلیِ همان شرکت می‌رسد، با عنوانِ خودش',
    /^جناب آقای کامران نمونه سرپرست محترم/.test(xl3.khad), xl3.khad);
  check('معاونِ منطقه با شهردارِ همان منطقه اشتباه نمی‌شود', xl3.region === 'معاون محترم مالی و اداری شهرداری منطقه پنج', xl3.region);

  // ============================================================== مینوت
  console.log('\n— نامِ مخاطب در مینوت —');
  const mn = await page.evaluate(async () => {
    const O = window.Officials, M = window.Model, MN = window.Minute;
    const X = window.XLSX;
    const rows = await X.read(await X.build([{ name: 'S', rows: [
      ['نام و نام خانوادگی', 'سمت', 'واحد'],
      ['آرش نمونه‌ای', 'شهردار', 'منطقه ۵'],
      ['مهتاب آزمایشی', 'معاون مالی و اداری', 'منطقه ۵'],
      ['کاوه فرضی', 'مدیرعامل', 'شرکت خدمات اداری شهر'],
      ['بهرام ساختگی', 'مدیرعامل', 'سازمان پارک‌ها و فضای سبز']
    ] }]).arrayBuffer());
    const det = O.detect(rows);
    await O.replace(O.parse(rows, det.header, det.map), { source: 'test.xlsx' });
    const rec = await M.create({ caseNo: '1405551', status: 'مفتوح رسیدگی', firstName: 'پرهام',
      lastName: 'آزمون', servicePlace: 'شهرداری منطقه پنج', contractType: 'مدت معین' });
    const R = id => MN.conf().recipients.find(r => r.id === id);
    const mayor = MN.build('invite', [rec], { recipient: R('mayor') });
    const region = MN.build('invite', [rec], { recipient: R('region') });
    const khad = MN.build('invite', [rec], { recipient: R('khadamat') });
    const off = MN.build('invite', [rec], { recipient: R('mayor'), withName: false });
    const deputy = MN.build('invite', [rec], { recipient: R('deputy') });
    const park = O.list().find(o => /پارک/.test(o.org));
    const adhoc = MN.build('invite', [rec], { recipient: O.asRecipient(park) });
    return { id: rec.id, mayor: mayor.to, region: region.to, khad: khad.to, off: off.to, deputy: deputy.to,
      adhoc: adhoc.to, adhocVerb: /شایسته است/.test(adhoc.text), full: /گیرنده: جناب آقای آرش/.test(mayor.full) };
  });
  check('گیرندهٔ «شهردار {منطقه}»: «جناب آقای آرش نمونه‌ای شهردار محترم منطقه پنج»',
    mn.mayor === 'جناب آقای آرش نمونه‌ای شهردار محترم منطقه پنج', mn.mayor);
  check('«معاون مالی و اداری شهرداری {منطقه}» و «مدیرعامل شرکت خدمات» هم نام می‌گیرند',
    /^جناب آقای مهتاب آزمایشی معاون محترم مالی و اداری/.test(mn.region) && /^جناب آقای کاوه فرضی/.test(mn.khad),
    mn.region + ' | ' + mn.khad);
  check('نامی که در دفتر نیست: فقط سمت', mn.deputy === 'معاون محترم شهردار تهران', mn.deputy);
  check('تیکِ «نام مخاطب» خاموش: فقط سمت', mn.off === 'شهردار محترم منطقه پنج');
  check('هر کسِ دفتر گیرنده می‌شود، با فعلِ رتبه‌اش', /^جناب آقای بهرام ساختگی مدیرعامل محترم سازمان پارک/.test(mn.adhoc) &&
    mn.adhocVerb, mn.adhoc);
  check('«کپی با سربرگ» هم همان سطر را دارد', mn.full);

  // پنجرهٔ مینوت
  const ui = await page.evaluate(async (id) => {
    window.UIMinute.open(window.App, [window.Model.get(id)], { type: 'invite' });
    await new Promise(r => setTimeout(r, 400));
    const sel = [...document.querySelectorAll('.mn-controls select')].find(s => s.querySelector('option[value="mayor"]'));
    sel.value = 'mayor'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    const head = () => document.querySelector('.mn-head .mn-hv').textContent;
    const h1 = head();
    const line = document.querySelector('.mn-addressee');
    const found = line && line.classList.contains('is-found') && /آرش نمونه‌ای/.test(line.textContent);
    const group = !!sel.querySelector('optgroup');
    line.querySelector('input[type=checkbox]').click();
    await new Promise(r => setTimeout(r, 200));
    const h2 = head();
    // گیرنده از دفتر
    const sel2 = [...document.querySelectorAll('.mn-controls select')].find(s => s.querySelector('optgroup'));
    const opt = [...sel2.querySelectorAll('optgroup option')].find(o => /پارک/.test(o.textContent));
    sel2.value = opt.value; sel2.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    const h3 = head();
    document.querySelectorAll('.modal .btn').forEach(b => { if (/بستن/.test(b.textContent)) b.click(); });
    return { h1, found, group, h2, h3 };
  }, mn.id);
  check('در پنجرهٔ مینوت: سطرِ گیرنده با نام، و «✓ نام مخاطب» زیرِ انتخاب', /^جناب آقای آرش/.test(ui.h1) && ui.found, ui.h1);
  check('برداشتنِ تیک، نام را برمی‌دارد', ui.h2 === 'شهردار محترم منطقه پنج', ui.h2);
  check('گروهِ «از دفتر مقامات» در فهرستِ گیرنده‌ها', ui.group && /بهرام ساختگی/.test(ui.h3), ui.h3);

  // ======================================================== فهرستِ تازه
  console.log('\n— فهرستِ تازه، وقتی کسی عوض شد —');
  const ch = await page.evaluate(async (id) => {
    const O = window.Officials, X = window.XLSX, MN = window.Minute, M = window.Model;
    const rows = await X.read(await X.build([{ name: 'S', rows: [
      ['نام و نام خانوادگی', 'سمت', 'واحد'],
      ['رامین جایگزین', 'شهردار', 'منطقه ۵'],
      ['مهتاب آزمایشی', 'معاون مالی و اداری', 'منطقه ۵'],
      ['کاوه فرضی', 'مدیرعامل', 'شرکت خدمات اداری شهر'],
      ['تینا تازه', 'شهردار', 'منطقه ۷']
    ] }]).arrayBuffer());
    window.UIOfficials.preview(rows, 'new.xlsx');
    await new Promise(r => setTimeout(r, 200));
    const modal = document.querySelector('.of-modal');
    const sum = modal.querySelector('.of-sum').textContent;
    const change = modal.querySelector('.of-change') && modal.querySelector('.of-change').textContent;
    const sample = [...modal.querySelectorAll('.of-sample li')].map(l => l.textContent);
    // «نگهشان دار» تیک نخورده: سازمانِ پارک‌ها حذف می‌شود
    [...modal.querySelectorAll('.modal-foot .btn')].find(b => /جایگزینی/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    const rec = M.get(id);
    const to = MN.build('invite', [rec], { recipient: MN.conf().recipients.find(r => r.id === 'mayor') }).to;
    const log = O.data().log.slice(-1)[0];
    // پنجرهٔ دفتر: آخرین جابه‌جایی‌ها
    window.UIOfficials.dialog(window.App);
    await new Promise(r => setTimeout(r, 200));
    const dlg = [...document.querySelectorAll('.of-modal')].pop();
    const logText = (dlg.querySelector('.of-log') || {}).textContent || '';
    const rowsN = dlg.querySelectorAll('.of-row').length;
    // ویرایشِ دستی: نامِ معاون
    const row = [...dlg.querySelectorAll('.of-row')].find(r => /مهتاب/.test(r.querySelector('input').value));
    const nameIn = row.querySelector('input');
    nameIn.value = 'نسرین دستی'; nameIn.dispatchEvent(new Event('input'));
    row.querySelector('select').value = 'سرکار خانم'; row.querySelector('select').dispatchEvent(new Event('change'));
    const preview = row.querySelector('.of-addr').textContent;
    [...dlg.querySelectorAll('.modal-foot .btn')].find(b => /ذخیره/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 300));
    const region = MN.build('invite', [rec], { recipient: MN.conf().recipients.find(r => r.id === 'region') }).to;
    return { sum, change, sample, to, log, n: O.list().length, logText, rowsN, preview, region,
      park: O.list().some(o => /پارک/.test(o.org)), exp: O.rows().length };
  }, mn.id);
  check('پیش از جایگزینی، فرق گفته می‌شود: تازه، عوض‌شده، در فایل نیست',
    /۱ تازه/.test(ch.sum) && /۱ عوض‌شده/.test(ch.sum) && /۱ در فایل نیست/.test(ch.sum), ch.sum);
  check('«شهردار محترم منطقه ۵: آرش نمونه‌ای ← رامین جایگزین»',
    /شهردار محترم منطقه ۵/.test(ch.change) && /آرش نمونه‌ای/.test(ch.change) && /رامین جایگزین/.test(ch.change), ch.change);
  check('بعد از جایگزینی، مینوت نامِ تازه را می‌نویسد', ch.to === 'جناب آقای رامین جایگزین شهردار محترم منطقه پنج', ch.to);
  check('آنچه در فایل نبود حذف شد', !ch.park && ch.n === 4);
  check('در «آخرین جابه‌جایی‌ها» می‌ماند', ch.log.changed.length === 1 && /رامین جایگزین/.test(ch.logText), ch.logText);
  check('ویرایشِ دستی در پنجرهٔ دفتر، با پیش‌نمایشِ سطر', ch.rowsN === 4 &&
    ch.preview === 'سرکار خانم نسرین دستی معاون محترم مالی و اداری منطقه ۵' &&
    /^سرکار خانم نسرین دستی/.test(ch.region), ch.region);

  // خروجیِ اکسل و ورودِ دوباره: همان دفتر
  const rt = await page.evaluate(async () => {
    const O = window.Officials, X = window.XLSX;
    const rows = await X.read(await X.build([{ name: 'S', rows: O.rows() }]).arrayBuffer());
    const d = O.detect(rows);
    const again = O.parse(rows, d.header, d.map);
    const df = O.diff(again);
    return { same: df.same, added: df.added.length, changed: df.changed.length, removed: df.removed.length };
  });
  check('«خروجی اکسل» دوباره بی‌تغییر وارد می‌شود', rt.same === 4 && !rt.added && !rt.changed && !rt.removed,
    JSON.stringify(rt));

  // ماندگاری و غلط‌یاب
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => window.Model && window.Model.state.cases.length > 5, null, { timeout: 20000 });
  const kept = await page.evaluate(() => {
    window.Spell.invalidate();
    return { n: window.Officials.list().length, spell: window.Spell.check('جناب آقای رامین جایگزین').length };
  });
  check('بعد از رفرش، دفتر سرِ جایش است', kept.n === 4);
  check('نام‌های دفتر را غلط‌یاب غلط نمی‌شمارد', kept.spell === 0);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
