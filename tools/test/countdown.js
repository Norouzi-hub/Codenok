/*
 * شمارش معکوسِ مهلت دفاعیه.
 *
 * در نامهٔ دعوت به کارمند یک مهلت داده می‌شود: «تا فلان تاریخ حاضر شوید
 * و دفاعیه‌تان را بدهید». این مجموعه می‌سنجد که آن یک تاریخ، همه‌جا یک
 * حرف بزند: کنار خودِ فیلد، بالای پرونده به‌شکل نوارِ متحرک، در فهرست
 * به‌شکل قرصِ ساعت، و در سررسیدِ کارتابل و تقویم.
 *
 * اجرا:  node tools/test/countdown.js
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

  // ================================================== موتور شمارش معکوس
  console.log('\n— یک تاریخ، یک حساب —');

  const engine = await page.evaluate(() => {
    const J = window.J, WL = window.Worklist, t = J.today();
    const base = {
      caseNo: 'X', status: 'مفتوح رسیدگی', intakeDate: '14040101',
      deliveryDate: '14040103', decreeDate: '14040105'
    };
    const mk = (due, extra) => Object.assign({}, base, {
      invitationLetterDate: J.addDays(due, -10), defenseDueDate: due
    }, extra || {});
    const w = (due, extra) => WL.defenseWatch(mk(due, extra));
    return {
      none: WL.defenseWatch(Object.assign({}, base)),
      safe: w(J.addDays(t, 7)),
      soon: w(J.addDays(t, 2)),
      today: w(t),
      late: w(J.addDays(t, -4)),
      // دفاعیه که رسید، شمارش تمام است
      received: w(J.addDays(t, -4), { defenseReceivedDate: J.addDays(t, -2) }),
      closed: w(J.addDays(t, -4), { status: 'ابلاغ و مختومه شد' }),
      transferred: w(J.addDays(t, -4), { transferDate: J.addDays(t, -6) }),
      // بدون تاریخ دعوت، مبنای درصد از مهلت پیش‌فرض تنظیمات می‌آید
      noInvite: WL.defenseWatch(Object.assign({}, base, {
        defenseDueDate: J.addDays(t, 5)
      }))
    };
  });
  check('بدون تاریخ مهلت، شمارشی در کار نیست', engine.none === null);
  check('مهلتِ دور، حالت آرام دارد',
    engine.safe.state === 'safe' && engine.safe.left === 7 &&
    engine.safe.total === 10 && engine.safe.pct === 30,
    JSON.stringify(engine.safe));
  check('سه روز مانده یعنی «نزدیک»',
    engine.soon.state === 'soon' && engine.soon.left === 2 && engine.soon.pct === 80,
    JSON.stringify(engine.soon));
  check('روزِ آخر، حالت خودش را دارد',
    engine.today.state === 'today' && engine.today.left === 0 &&
    engine.today.pct === 100, JSON.stringify(engine.today));
  check('مهلتِ گذشته، سرخ است و درصدش از صد بیشتر نمی‌شود',
    engine.late.state === 'late' && engine.late.left === -4 &&
    engine.late.pct === 100, JSON.stringify(engine.late));
  check('دفاعیه که رسید، شمارش تمام می‌شود', engine.received === null);
  check('پروندهٔ مختومه و ارجاع‌شده شمارش ندارند',
    engine.closed === null && engine.transferred === null);
  check('بدون تاریخ دعوت هم شمارش کار می‌کند (مبنا: مهلت پیش‌فرض)',
    engine.noInvite && engine.noInvite.left === 5 && engine.noInvite.total === 10,
    JSON.stringify(engine.noInvite));

  // ============================================ سررسیدِ کارتابل و تقویم
  console.log('\n— سررسیدِ کارتابل از همان مهلت می‌آید، نه از حدس —');

  const action = await page.evaluate(() => {
    const J = window.J, WL = window.Worklist, t = J.today();
    const base = {
      caseNo: 'X', status: 'مفتوح رسیدگی', intakeDate: '14040101',
      deliveryDate: '14040103', decreeDate: '14040105',
      invitationLetterDate: J.addDays(t, -8)
    };
    const plain = WL.nextAction(base);
    const withDue = WL.nextAction(Object.assign({}, base, {
      defenseDueDate: J.addDays(t, 6)      // مهلتِ ۱۴ روزه، نه ۱۰ روزِ پیش‌فرض
    }));
    const past = WL.nextAction(Object.assign({}, base, {
      defenseDueDate: J.addDays(t, -1)
    }));
    return {
      plainKey: plain.key, plainDue: plain.due,
      key: withDue.key, due: withDue.due, limit: withDue.limit,
      remaining: withDue.remaining, overdue: withDue.overdue,
      expected: J.addDays(t, 6),
      pastOverdue: past.overdue
    };
  });
  check('بدون مهلتِ ثبت‌شده، همان مهلت پیش‌فرض کار می‌کند',
    action.plainKey === 'defense' && !!action.plainDue, action.plainDue);
  check('با مهلتِ ثبت‌شده، سررسید دقیقاً همان تاریخ است',
    action.due === action.expected && action.limit === 14 &&
    action.remaining === 6 && !action.overdue, JSON.stringify(action));
  check('مهلتی که گذشته، پرونده را عقب‌افتاده می‌کند', action.pastOverdue === true);

  // ================================================== نوار بالای پرونده
  console.log('\n— نوارِ متحرک بالای پرونده —');

  const ids = await page.evaluate(async () => {
    const J = window.J, t = J.today();
    const mk = async (no, due, extra) => {
      const r = await window.Model.create(Object.assign({
        caseNo: no, status: 'مفتوح رسیدگی', firstName: 'سارا', lastName: 'احمدی',
        intakeDate: '14040101', deliveryDate: '14040103', decreeDate: '14040105',
        invitationLetterDate: J.addDays(due, -10), defenseDueDate: due
      }, extra || {}));
      return (r.record || r).id;
    };
    return {
      soon: await mk('1405911', J.addDays(t, 2)),
      late: await mk('1405914', J.addDays(t, -4)),
      chased: await mk('1405915', J.addDays(t, -6),
        { defenseChaseLetterDate: J.addDays(t, -1) }),
      plain: await mk('1405916', '', {})   // بدون مهلت
    };
  });

  const card = await page.evaluate(async (id) => {
    window.App.state.formTab = 'defense';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 1300));
    const box = document.querySelector('.case-next.countdown');
    if (!box) return { missing: true };
    const fill = box.querySelector('.cd-fill');
    return {
      cls: box.className,
      text: box.textContent,
      lineW: Math.round(box.querySelector('.cd-line').getBoundingClientRect().width),
      fillW: Math.round(fill.getBoundingClientRect().width),
      buttons: [...box.querySelectorAll('.btn')].map(b => b.textContent)
    };
  }, ids.late);
  check('مهلتِ گذشته، بالای پرونده هشدار سرخ می‌شود',
    /is-late/.test(card.cls) && /۴ روز از مهلت گذشته/.test(card.text),
    (card.text || '').slice(0, 80));
  check('خطِ متحرک واقعاً کشیده می‌شود، نه صفر',
    card.lineW > 100 && card.fillW >= card.lineW - 1,
    card.fillW + ' از ' + card.lineW + 'px');
  check('کنار هشدار، راهِ انجام کار هست',
    card.buttons.some(b => /نامهٔ پیگیری/.test(b)) &&
    card.buttons.some(b => /دفاعیه رسید/.test(b)), card.buttons.join(' | '));

  const chased = await page.evaluate(async (id) => {
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 900));
    const box = document.querySelector('.case-next.countdown');
    return {
      text: box.textContent,
      buttons: [...box.querySelectorAll('.btn')].map(b => b.textContent)
    };
  }, ids.chased);
  check('وقتی نامهٔ پیگیری رفته، دوباره پیشنهادش نمی‌دهد',
    !chased.buttons.some(b => /نامهٔ پیگیری/.test(b)) &&
    /نامهٔ پیگیری رفته است/.test(chased.text), chased.buttons.join(' | '));

  const soonCard = await page.evaluate(async (id) => {
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 1300));
    const box = document.querySelector('.case-next.countdown');
    const fill = box.querySelector('.cd-fill');
    const line = box.querySelector('.cd-line');
    return {
      cls: box.className, text: box.textContent,
      ratio: fill.getBoundingClientRect().width / line.getBoundingClientRect().width
    };
  }, ids.soon);
  check('دو روز مانده: هشدارِ برنجی، نه سرخ',
    /is-soon/.test(soonCard.cls) && /۲ روز تا پایان مهلت/.test(soonCard.text),
    (soonCard.text || '').slice(0, 60));
  check('طول خط، همان درصدِ سپری‌شده است',
    Math.abs(soonCard.ratio - 0.8) < 0.05, soonCard.ratio.toFixed(2));

  const none = await page.evaluate(async (id) => {
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 700));
    return !!document.querySelector('.case-next.countdown');
  }, ids.plain);
  check('پرونده‌ای که مهلت ندارد، هشدارِ بی‌خود نمی‌گیرد', none === false);

  // ============================================== چیپِ کنار خودِ فیلد
  console.log('\n— شمارش، چسبیده به همان فیلد —');

  const chip = await page.evaluate(async (id) => {
    window.App.state.formTab = 'defense';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 800));
    const field = document.querySelector('[data-field="defenseDueDate"]');
    const before = field.querySelector('.cd-inline').textContent;
    /* تاریخ را در همان فیلد می‌نویسیم — بدون ذخیره — و انتظار داریم
       شمارش همان‌جا و همان لحظه به راه بیفتد. */
    const input = field.querySelector('input');
    input.value = window.U.toFaDigits(
      window.J.format(window.J.addDays(window.J.today(), 5)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    const box = field.querySelector('.cd-inline');
    return {
      before: before,
      after: box.textContent,
      cls: box.className,
      fill: Math.round(box.querySelector('.cd-fill').getBoundingClientRect().width)
    };
  }, ids.plain);
  check('تا تاریخی نباشد، خودش می‌گوید چه باید کرد',
    /شمارش معکوس شروع شود/.test(chip.before), chip.before);
  check('تاریخ که وارد شد، همان‌جا و بدون ذخیره شمارش می‌کند',
    /۵ روز تا پایان مهلت/.test(chip.after) && chip.fill > 0,
    chip.after + ' — ' + chip.fill + 'px');

  const done = await page.evaluate(async (id) => {
    const field = document.querySelector('[data-field="defenseReceivedDate"] input');
    field.value = window.U.toFaDigits(window.J.format(window.J.today()));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    document.querySelector('.case-save').click();
    await new Promise(r => setTimeout(r, 900));
    window.App.state.formTab = 'defense';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 700));
    return {
      chip: (document.querySelector('.cd-inline') || {}).textContent,
      card: !!document.querySelector('.case-next.countdown')
    };
  }, ids.plain);
  check('دفاعیه که ثبت شد، شمارش تمام می‌شود و هشدار می‌خوابد',
    /شمارش تمام شد/.test(done.chip || '') && done.card === false,
    (done.chip || '') + ' • هشدار: ' + done.card);

  // ==================================================== ساعتِ فهرست
  console.log('\n— قرصِ ساعت در فهرست پرونده‌ها —');

  const list = await page.evaluate(async () => {
    window.App.goList();
    await new Promise(r => setTimeout(r, 1200));
    const clocks = [...document.querySelectorAll('.tr .cd-clock')];
    return {
      head: !!document.querySelector('.th-clock'),
      n: clocks.length,
      states: clocks.map(c => c.className.replace('cd-clock ', '')),
      labels: clocks.map(c => c.textContent),
      titled: clocks.every(c => /مهلت دفاعیه/.test(c.title)),
      // ساعت نباید از خانهٔ خودش بیرون بزند
      fits: clocks.every(c => {
        const cell = c.closest('.td');
        return c.getBoundingClientRect().width <= cell.getBoundingClientRect().width + 1;
      }),
      // ریل هم همین‌طور — با هجده مرحله، ستونش باید جا داشته باشد
      railFits: [...document.querySelectorAll('.tr .rail-mini')].every(r => {
        const cell = r.closest('.td');
        return r.getBoundingClientRect().width <= cell.getBoundingClientRect().width + 1;
      })
    };
  });
  check('ستون ساعت با سربرگِ خودش می‌آید', list.head);
  check('فقط پرونده‌های مهلت‌دار ساعت می‌گیرند', list.n === 3,
    list.n + ' ساعت: ' + list.labels.join(' / '));
  check('حالتِ هر ساعت با مهلتش می‌خواند',
    list.states.filter(s => /is-late/.test(s)).length === 2 &&
    list.states.filter(s => /is-soon/.test(s)).length === 1,
    list.states.join(' / '));
  check('روی هر ساعت، جملهٔ کامل نوشته شده است', list.titled);
  check('ساعت و ریل، هر دو در خانهٔ خودشان جا می‌شوند',
    list.fits && list.railFits, 'ساعت: ' + list.fits + ' • ریل: ' + list.railFits);

  const noClock = await page.evaluate(async () => {
    /* وقتی هیچ پرونده‌ای مهلت باز ندارد، ستونِ خالی هم نباید باشد. */
    window.App.state.q = '۱۴۰۵۲۳۲';
    window.App.refresh(true);
    await new Promise(r => setTimeout(r, 900));
    const out = {
      head: !!document.querySelector('.th-clock'),
      rows: document.querySelectorAll('.tr').length
    };
    window.App.state.q = '';
    window.App.refresh(true);
    return out;
  });
  check('نتیجه‌ای که مهلت‌دار ندارد، ستون ساعت هم ندارد',
    !noClock.head && noClock.rows > 0, noClock.rows + ' سطر');

  // ============================================ جداکنندهٔ نقطه در RTL
  console.log('\n— «۴ روز» نباید «۴۰ روز» خوانده شود —');

  const dots = await page.evaluate(async (id) => {
    window.App.state.formTab = 'defense';
    window.App.openCase(id);
    await new Promise(r => setTimeout(r, 800));
    const meta = document.querySelector('.case-next-meta');
    return {
      parts: [...meta.children].map(n => n.textContent),
      raw: meta.textContent,
      hasSep: getComputedStyle(meta.children[1], '::before').content
    };
  }, ids.late);
  check('هر تکهٔ نوار اقدام، span خودش را دارد (نه رشته‌ای با «•»)',
    dots.parts.length >= 2 && dots.raw.indexOf('•') < 0,
    dots.parts.join(' | '));
  check('جداکننده از CSS می‌آید', /•/.test(dots.hasSep), dots.hasSep);

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });
