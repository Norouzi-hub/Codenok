/*
 * مینوت نامه: قاعده‌های دبیرخانه، متن، و ثبت در کارها.
 *
 * نام‌ها و شماره‌های این آزمون ساختگی‌اند؛ فقط *شکلِ* متن از نمونه‌های
 * دبیرخانه گرفته شده.
 *
 *   ۱) فعل از رتبهٔ گیرنده: پایین‌دست مقتضی، همتراز شایسته، بالادست خواهشمند.
 *   ۲) ارجاع: نامهٔ گیرنده «بازگشت به» (عطف)، نامهٔ ما «پیرو»، بقیه «با عنایت
 *      به» (در ارتباط)؛ رونوشت؛ بی‌شماره فقط تاریخ؛ محرمانه بی‌ارجاع.
 *   ۳) چهار نامه: دعوت به کمیته، دعوت به جلسه، تکمیل مستندات، بستن حقوق.
 *   ۴) چند نفر در یک نامه.
 *   ۵) پنجره، ثبت در تاریخچه و کارنامه و کارکرد، و ثبت شمارهٔ نامهٔ صادره.
 *
 * اجرا:  node tools/test/minute.js
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
const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await bootApp(page, APP);

  const ids = await page.evaluate(async () => {
    const M = window.Model;
    const a = await M.create({
      caseNo: '1405801', status: 'مفتوح رسیدگی', firstName: 'بهرام', lastName: 'نیک‌پور',
      gender: 'مرد', nationalId: '0012345679', contractType: 'شرکت خدمات اداری شهر',
      servicePlace: 'شهرداری منطقه پنج', letterNo: '48120507', letterDate: '14050631',
      reporterOrg: 'شرکت خدمات اداری شهر', defenseDueDate: '14050713', caseType: 'غیبت',
      committeeDate: '14050719'
    });
    const b = await M.create({
      caseNo: '1405802', status: 'مفتوح رسیدگی', firstName: 'کامران', lastName: 'سپهری',
      gender: 'مرد', contractType: 'شرکت خدمات اداری شهر', servicePlace: 'شهرداری منطقه پنج',
      letterDate: '14050620', reporterOrg: 'نهاد راهبردی', caseType: 'غیبت'
    });
    const c = await M.create({
      caseNo: '1405803', status: 'مفتوح رسیدگی', firstName: 'زهره', lastName: 'امینی',
      gender: 'زن', contractType: 'قرارداد مدت معین سازمان یا شرکت',
      servicePlace: 'شهرداری منطقه هشت', letterNo: '31407/208', letterDate: '14050630',
      reporterOrg: 'شهرداری منطقه هشت'
    });
    return { a: a.id, b: b.id, c: c.id };
  });

  // =========================================================== قاعده‌ها
  console.log('— فعل از رتبهٔ گیرنده، ارجاع از جنسِ نامه —');
  const r = await page.evaluate((ids) => {
    const MN = window.Minute, M = window.Model;
    const A = M.get(ids.a), B = M.get(ids.b), C = M.get(ids.c);
    const rc = k => MN.conf().recipients.find(x => x.id === k);
    const out = {};
    out.sugA = MN.suggestRecipient(A).id;
    out.sugC = MN.suggestRecipient(C).id;
    out.low = MN.build('invite', [A]);
    out.peer = MN.build('invite', [A], { recipient: rc('region') });
    out.high = MN.build('invite', [A], { recipient: rc('mayor') });
    out.noNo = MN.build('invite', [B], { recipient: rc('region') });
    out.copy = MN.build('invite', [A], { recipient: rc('region'), ref: { source: 'case', copy: true } });
    out.conf = MN.build('invite', [A], { confidential: true });
    out.none = MN.build('invite', [A], { ref: { source: 'none' } });
    out.forced = MN.build('invite', [A], { ref: { source: 'case', relation: 'related' } });
    out.custom = MN.build('invite', [A], { ref: { source: 'custom', no: '70512', date: '1405/02/01', from: 'نهاد راهبردی' } });
    out.atfC = MN.build('invite', [C], { recipient: rc('region') });
    const X = Object.assign({}, A, { invitationLetterNo: '41000', invitationLetterDate: '14050705' });
    out.ours = MN.build('invite', [X], { ref: { source: 'ours:invitation' } });
    const s = x => ({ text: x.text, rel: x.relation, relText: x.relationText, to: x.to, attach: x.attach, subject: x.subject });
    Object.keys(out).forEach(k => { if (out[k] && out[k].text) out[k] = s(out[k]); });
    return out;
  }, ids);

  check('گیرندهٔ پیشنهادی از «نوع قرارداد»: شرکت خدمات اداری شهر', r.sugA === 'khadamat', r.sugA);
  check('قرارداد مدت معین: محل خدمت (همتراز)', r.sugC === 'region', r.sugC);
  check('پایین‌دست ← «مقتضی است»', /مقتضی است دستور فرمایید/.test(r.low.text));
  check('همتراز ← «شایسته است»', /شایسته است دستور فرمایید/.test(r.peer.text));
  check('بالادست ← «خواهشمند است»', /خواهشمند است دستور فرمایید/.test(r.high.text));
  check('نامهٔ خودِ گیرنده: «بازگشت به» و عطف',
    r.low.rel === 'atf' && r.low.text.indexOf('بازگشت به نامهٔ شمارهٔ ' + fa('48120507') +
      ' مورخ ' + fa('1405/06/31') + '، مقتضی است') >= 0 &&
    r.low.relText === 'عطف به نامهٔ شمارهٔ ' + fa('48120507') + ' مورخ ' + fa('1405/06/31'),
    r.low.relText);
  check('نامهٔ دیگری: «با عنایت به» و در ارتباط، با فرستنده', r.peer.rel === 'related' &&
    /با عنایت به نامهٔ شمارهٔ .+ شرکت خدمات اداری شهر، شایسته است/.test(r.peer.text), r.peer.relText);
  check('نامهٔ بی‌شماره: فقط تاریخ', /با عنایت به نامهٔ مورخ ۱۴۰۵\/۰۶\/۲۰ نهاد راهبردی/.test(r.noNo.text),
    r.noNo.text.split('\n')[1].slice(0, 60));
  check('رونوشت: «با عنایت به رونوشت نامهٔ …»', /با عنایت به رونوشت نامهٔ شمارهٔ/.test(r.copy.text));
  check('محرمانه: بی‌ارجاع، مستقیم سرِ درخواست',
    !/بازگشت به|پیرو نامه|با عنایت به نامه/.test(r.conf.text) &&
    /^با سلام و احترام؛\nمقتضی است دستور فرمایید/.test(r.conf.text) &&
    /محرمانه/.test(r.conf.relText), r.conf.relText);
  check('بدون ارجاع', /^با سلام و احترام؛\nمقتضی است/.test(r.none.text) && r.none.relText === 'بدون ارجاع');
  check('نوع ارتباط را می‌شود دستی عوض کرد', r.forced.rel === 'related' && /^با سلام و احترام؛\nبا عنایت به/.test(r.forced.text));
  check('نامهٔ دیگرِ دستی، با شماره و تاریخ و فرستنده',
    /با عنایت به نامهٔ شمارهٔ ۷۰۵۱۲ مورخ ۱۴۰۵\/۰۲\/۰۱ نهاد راهبردی/.test(r.custom.text));
  check('نامهٔ خودمان: «پیرو» و پیرو', r.ours.rel === 'peyro' &&
    /پیرو نامهٔ شمارهٔ ۴۱۰۰۰ مورخ ۱۴۰۵\/۰۷\/۰۵/.test(r.ours.text) && /^پیرو نامهٔ/.test(r.ours.relText),
    r.ours.relText);
  check('شمارهٔ «۲۲۹۲۱/۵۱۷» درست نوشته می‌شود و منطقهٔ خودش عطف است',
    r.atfC.rel === 'atf' && r.atfC.text.indexOf(fa('31407/208')) >= 0, r.atfC.relText);

  console.log('\n— معرفی کارمند: به کارفرما یا به محل خدمت —');
  check('به شرکت: «از کارکنان قراردادی آن شرکت»',
    /به آقای بهرام نیک‌پور از کارکنان قراردادی آن شرکت، ابلاغ گردد/.test(r.low.text));
  check('به منطقه: «… طرف قرارداد شرکت خدمات اداری شهر شاغل در آن منطقه»',
    /از کارکنان طرف قرارداد شرکت خدمات اداری شهر شاغل در آن منطقه/.test(r.peer.text));
  check('خانم و قرارداد مدت معین', /به خانم زهره امینی از کارکنان قرارداد مدت معین آن منطقه/.test(r.atfC.text));
  check('گیرنده با منطقهٔ پرونده', r.peer.to === 'معاون محترم مالی و اداری شهرداری منطقه پنج', r.peer.to);

  // ========================================================= چهار نامه
  console.log('\n— چهار نامه —');
  const t = await page.evaluate((ids) => {
    const MN = window.Minute, M = window.Model;
    const A = M.get(ids.a), B = M.get(ids.b);
    const rc = k => MN.conf().recipients.find(x => x.id === k);
    return {
      invite: MN.build('invite', [A], { opts: { about: 'قرارداد شمارهٔ ۳۵۴۱' } }).text,
      hearing: MN.build('hearing', [A], { recipient: rc('region') }),
      defect: MN.build('defect', [A]).text,
      defectInv: MN.build('defect', [A], { opts: { withInvite: true } }),
      salary: MN.build('salaryStop', [A]),
      salaryOnly: MN.build('salaryStop', [A], { opts: { withInvite: false } }).text,
      multi: MN.build('salaryStop', [A, B]).text,
      mixed: MN.people([A, M.get(ids.c)]),
      weekday: (p => window.J.weekday(p.jy, p.jm, p.jd))(window.J.unpack('14050719')),
      before: MN.dayBefore('14050719'), beforeSat: MN.dayBefore('14050725')
    };
  }, ids);
  check('دعوت: مهلت از «مهلت حضور و ارائه دفاعیه»، «در ارتباط با»، دو بند ثابت',
    t.invite.indexOf('جهت ادای توضیح در ارتباط با قرارداد شمارهٔ ۳۵۴۱، حداکثر تا تاریخ ۱۴۰۵/۰۷/۱۳') >= 0 &&
    /بدیهی است هرگونه خروج از خدمت نامبرده/.test(t.invite) && /متعاقباً ارسال خواهد شد/.test(t.invite));
  check('جلسه: ساعت، روزِ هفته، تاریخ و محل', t.hearing.text.indexOf('راس ساعت ۱۴:۰۰ روز ' + t.weekday +
    ' مورخ ۱۴۰۵/۰۷/۱۹ در جلسهٔ کمیتهٔ انضباط کار، که در شهرداری منطقهٔ یک') >= 0, t.weekday);
  check('جلسه: مهلت پیامک، روز کاریِ پیش از جلسه', t.before === '14050718' &&
    /روز شنبه مورخ ۱۴۰۵\/۰۷\/۱۸/.test(t.hearing.text), t.before);
  check('پیش از شنبه، پنج‌شنبه و جمعه رد می‌شوند', t.beforeSat === '14050722', t.beforeSat);
  check('جلسه: تبصرهٔ ۳۰ مادهٔ ۳۶', /تبصرهٔ ۳۰ مادهٔ ۳۶/.test(t.hearing.text) &&
    t.hearing.attach === 'فرم دعوت به جلسه');
  check('تکمیل مستندات: آیین‌نامه، کد ملی، فهرست مدارک، بند پایانی',
    /در خصوص اعلام غیبت آقای بهرام نیک‌پور \(کد ملی: ۰۰۱۲۳۴۵۶۷۹\)/.test(t.defect) &&
    /ابلاغ آیین‌نامهٔ کمیتهٔ انضباط کار به شمارهٔ ۱۰۹۱۳۴۸ مورخ ۱۴۰۲\/۰۹\/۲۵/.test(t.defect) &&
    /\(فرم اعلام تخلف شمارهٔ ۱، صورتجلسهٔ شورای عملیاتی تحول اداری، پرینت تردد ایام غیبت\)/.test(t.defect) &&
    /عدم وصول مستندات لازم/.test(t.defect));
  check('تکمیل مستندات + دعوت: فرم شمارهٔ ۴ و پیوستش',
    /فرم شمارهٔ ۴ دعوت به کمیتهٔ انضباط کار \(به پیوست\)/.test(t.defectInv.text) &&
    /فرم شمارهٔ ۴/.test(t.defectInv.attach));
  check('بستن حقوق + دعوت: «ضمن خودداری از پرداخت هرگونه وجه»',
    /ضمن خودداری از پرداخت هرگونه وجه، به نامبرده ابلاغ گردد/.test(t.salary.text) &&
    /\(تصویر پیوست\)/.test(t.salary.text));
  check('بستن حقوق تنها: «از پرداخت هرگونه وجه … خودداری نمایند»',
    /از پرداخت هرگونه وجه به نامبرده خودداری نمایند/.test(t.salaryOnly) && !/ابلاغ گردد/.test(t.salaryOnly));
  check('چند نفر: «آقایان … و …» و «نامبردگان»',
    /آقایان بهرام نیک‌پور و کامران سپهری/.test(t.multi) && /به نامبردگان ابلاغ گردد/.test(t.multi) &&
    /خروج از خدمت نامبردگان/.test(t.multi));
  check('مرد و زن با هم: «آقای … و خانم …»', t.mixed === 'آقای بهرام نیک‌پور و خانم زهره امینی', t.mixed);

  // ============================================================ پنجره
  console.log('\n— پنجره، ثبت در کارها، شمارهٔ نامهٔ صادره —');
  const ui = await page.evaluate(async (ids) => {
    window.App.openCase(ids.a);
    await new Promise(r => setTimeout(r, 800));
    const btn = document.querySelector('.case-forms');
    if (!btn || !/نامه و فرم/.test(btn.textContent)) return { noBtn: true };
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const item = [...document.querySelectorAll('.sheet-item')].find(b => /مینوت دعوت به کمیته/.test(b.textContent));
    if (!item) return { noBtn: true };
    item.click();
    await new Promise(r => setTimeout(r, 400));
    const body = () => document.querySelector('.mn-body').value;
    const out = { first: body(), head: document.querySelector('.mn-head').textContent };
    [...document.querySelectorAll('.mn-type')].find(b => /جلسه/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 100));
    out.hearing = body();
    const sel = document.querySelector('.mn-controls select');
    sel.value = 'mayor'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    out.mayor = body();
    // دست‌نوشته با کلید بعدی پاک نمی‌شود
    const ta = document.querySelector('.mn-body');
    ta.value = ta.value + '\nجملهٔ دستی.'; ta.dispatchEvent(new Event('input'));
    const sel2 = document.querySelector('.mn-controls select');
    sel2.value = 'region'; sel2.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    out.keptEdit = /جملهٔ دستی/.test(body());
    // عوض کردن نوع، با متنِ دستی، اول می‌پرسد
    [...document.querySelectorAll('.mn-type')].find(b => /دعوت به کمیته/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 150));
    out.asked = [...document.querySelectorAll('.modal h3')].some(h => /نوع نامه عوض شود/.test(h.textContent));
    [...document.querySelectorAll('.overlay')].pop().querySelector('.btn.danger').click();
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.mn-rebuild').click();
    out.rebuilt = !/جملهٔ دستی/.test(body()) && /حداکثر تا تاریخ/.test(body());

    const before = window.Model.historyFor(ids.a).filter(h => h.kind === 'minute').length;
    const copyBtn = [...document.querySelectorAll('.modal-foot .btn')].find(b => /کپی برای اتوماسیون/.test(b.textContent));
    copyBtn.click(); copyBtn.click();
    await new Promise(r => setTimeout(r, 300));
    out.logged = window.Model.historyFor(ids.a).filter(h => h.kind === 'minute').length - before;
    out.logNote = (window.Model.historyFor(ids.a).filter(h => h.kind === 'minute').pop() || {}).note;

    // شمارهٔ نامهٔ صادره
    const reg = document.querySelector('.mn-reg input.input.small');
    reg.value = '41234'; reg.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('.mn-reg .btn')].pop().click();
    await new Promise(r => setTimeout(r, 600));
    const rec = window.Model.get(ids.a);
    out.reg = { no: rec.invitationLetterNo, date: rec.invitationLetterDate, today: window.J.today() };
    document.querySelectorAll('.overlay').forEach(o => o.remove());

    const J = window.J, t = J.today();
    const act = window.Activity.bundle(J.addDays(t, -1), t);
    out.activity = act.days[act.days.length - 1].counts['letter.minute'] || 0;
    out.karnameh = window.Karnameh.build(t, t).totals.minutes;
    out.headline = window.Karnameh.headline(window.Karnameh.build(t, t));
    return out;
  }, ids);
  if (ui.noBtn) check('«نامه و فرم» در پرونده، با مینوت‌ها', false);
  else {
    check('«نامه و فرم» ← «مینوت دعوت به کمیته»، و متنِ آماده', /مقتضی است/.test(ui.first) &&
      /گیرنده/.test(ui.head) && /عطف به نامهٔ/.test(ui.head));
    check('عوض کردن نوع، متن را عوض می‌کند', /در جلسهٔ کمیتهٔ انضباط کار/.test(ui.hearing));
    check('عوض کردن گیرنده، فعل را عوض می‌کند', /خواهشمند است/.test(ui.mayor));
    check('دست‌نوشته با کلیدِ بعدی نمی‌پرد؛ عوض کردن نوع اول می‌پرسد', ui.keptEdit && ui.asked && ui.rebuilt,
      JSON.stringify([ui.keptEdit, ui.asked, ui.rebuilt]));
    check('یک بار در تاریخچه، نه به تعداد کلیک', ui.logged === 1, ui.logged + ' — ' + ui.logNote);
    check('شمارهٔ نامهٔ صادره در پرونده نشست', ui.reg.no === '41234' && ui.reg.date === ui.reg.today,
      JSON.stringify(ui.reg));
    check('در خروجی کارکرد روزانه شمرده می‌شود', ui.activity === 1, ui.activity);
    check('و در کارنامه', ui.karnameh === 1 && /مینوت نامه نوشته شد/.test(ui.headline), ui.headline);
  }

  const more = await page.evaluate(async (ids) => {
    // تنظیمات: رتبهٔ گیرنده عوض شود، فعل عوض شود
    const MN = window.Minute;
    const list = MN.conf().recipients.map(r => r.id === 'khadamat' ? Object.assign({}, r, { rank: 'peer' }) : r);
    await MN.saveConf({ recipients: list });
    const after = MN.build('invite', [window.Model.get(ids.a)]).text;
    await MN.saveConf({ recipients: MN.DEFAULTS.recipients });
    // بخش تنظیمات
    document.querySelector('[title="تنظیمات"]').click();
    await new Promise(r => setTimeout(r, 500));
    const set = !!document.querySelector('.mn-settings') &&
      document.querySelectorAll('.mn-rcp-list .mn-rcp').length === MN.DEFAULTS.recipients.length;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    // نوار انتخابِ فهرست
    window.App.goList();
    await new Promise(r => setTimeout(r, 500));
    const boxes = [...document.querySelectorAll('.row-check, input[type=checkbox].sel')];
    return { after, set, boxes: boxes.length };
  }, ids);
  check('رتبه در تنظیمات، فعل را عوض می‌کند', /شایسته است/.test(more.after));
  check('بخش «مینوت نامه» در تنظیمات، با فهرست گیرنده‌ها', more.set);

  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(failures ? '\n✗ ' + failures + ' مورد شکست خورد' : '\n✓ همه درست بود');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
