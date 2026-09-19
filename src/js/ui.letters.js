/*
 * فرم‌های اداری: همان برگه‌هایی که تا امروز دستی تایپ می‌شدند.
 *
 * چهار فرم، دقیقاً با چیدمان نمونه‌های خود دبیرخانه:
 *   ۱) خلاصهٔ پرونده        — روی کاغذ سفید A4
 *   ۲) تفهیم اتهام و دفاعیه — روی سربرگ
 *   ۳) رأی صادره            — روی سربرگ
 *   ۴) ابلاغ رأی            — روی سربرگ
 *
 * «روی سربرگ» یعنی حاشیهٔ بالا و حاشیهٔ سمت راست خالی می‌ماند تا متن روی
 * چاپِ خودِ سازمان (آرم بالا و نوار کنارِ راست) نیفتد. هر دو اندازه در
 * تنظیمات قابل تغییر است، چون سربرگ هر اداره فرق دارد، و هر دو «از لبهٔ
 * کاغذ» شمرده می‌شوند — همان چیزی که با خط‌کش روی برگهٔ چاپی اندازه می‌گیرید.
 *
 * دو خروجی از یک سند: چاپ (PDF) و ورد (docx واقعی، قابل ویرایش). هر دو از
 * یک توصیف ساخته می‌شوند تا هیچ‌وقت با هم فرق نکنند.
 *
 * هرچه از پرونده درمی‌آید خودکار پر می‌شود؛ باقی‌مانده (چیزهایی که در دیتابیس
 * نیستند، مثل نام شهردار یا سابقهٔ کار) یک بار پرسیده می‌شود و جواب‌های ثابت
 * (اعضای کمیته، رونوشت‌ها، امضاکننده) در تنظیمات می‌ماند تا دوباره پرسیده نشود.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }
  /* در نامهٔ اداری، ارقام فارسی نوشته می‌شوند — حتی شناسه‌ها؛ برخلاف صفحهٔ
     نمایش که شناسه را لاتین نگه می‌دارد تا کپی و مقایسه آسان باشد. */
  function val(v) { return w.U.toFaDigits(String(v == null ? '' : v).trim()); }
  function dash(v) { return val(v) || '—'; }
  function dots(v) { return val(v) || '......................'; }

  var DEFAULT_MEMBERS = [
    { name: '', role: 'نمایندهٔ کارکنان' },
    { name: '', role: 'نمایندهٔ کارکنان' },
    { name: '', role: 'نمایندهٔ کارکنان' },
    { name: '', role: 'نمایندهٔ سرپرستان' },
    { name: '', role: 'نمایندهٔ مدیریت' },
    { name: '', role: 'نمایندهٔ مدیریت' },
    { name: '', role: 'نمایندهٔ مدیریت' }
  ];

  var DEFAULT_CC = [
    'ریاست محترم سازمان بازرسی شهرداری تهران برای استحضار.',
    'معاون محترم حفاظت پرسنلی سازمان حراست شهرداری تهران برای استحضار.',
    'نمایندهٔ محترم شهردار و دبیر هیئت مرکزی گزینش شهرداری تهران برای استحضار.',
    'مدیر کل محترم دفتر هماهنگی هیئت‌های رسیدگی به تخلفات اداری کارمندان برای آگاهی.',
    'ادارهٔ کمیتهٔ انضباط کار برای اطلاع.',
    'ادارهٔ امور مرخصی‌ها برای اطلاع و اقدام لازم.',
    'ادارهٔ کارکنان قراردادی مناطق و واحدهای ستادی برای اطلاع و اقدام لازم.'
  ];

  var DEFAULTS = {
    orgTitle: 'کمیتهٔ انضباط کار شهرداری تهران',
    letterheadTop: 45,          // میلی‌متر، از لبهٔ بالای کاغذ
    letterheadRight: 25,        // میلی‌متر، از لبهٔ راست کاغذ (نوار کنار سربرگ)
    letterheadBottom: 25,
    signerName: '',
    signerRole: 'مدیر کل',
    preparedBy: '',
    regulation: 'آیین‌نامهٔ انضباط کار مصوب ۱۴۰۲/۰۵/۰۸ وزارت تعاون، کار و رفاه اجتماعی',
    members: DEFAULT_MEMBERS,
    cc: DEFAULT_CC
  };

  /* حاشیهٔ خود کاغذ در چاپ، از  @page  در app.css. تنظیمات سربرگ «از لبهٔ
     کاغذ» است، پس برای چاپ باید همین مقدار از آن کم شود وگرنه دو بار
     حساب می‌شود؛ در ورد مستقیم حاشیهٔ صفحه گذاشته می‌شود. */
  var PAGE = { top: 14, side: 12 };

  function beyond(total, base) {
    var n = Number(total);
    return Math.max(0, (isFinite(n) ? n : 0) - base);
  }

  /** تنظیمات فرم‌ها، با پیش‌فرض‌های پر */
  function conf() {
    var saved = M.state.settings.letters || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = saved[k] != null && saved[k] !== '' ? saved[k] : DEFAULTS[k];
    });
    if (!Array.isArray(out.members) || !out.members.length) out.members = DEFAULT_MEMBERS;
    if (!Array.isArray(out.cc)) out.cc = DEFAULT_CC;
    return out;
  }

  function saveConf(patch) {
    var next = Object.assign({}, conf(), patch);
    return M.saveSettings({ letters: next });
  }

  // ------------------------------------------------------------------ چاپ
  function area() {
    var node = document.getElementById('print-area');
    w.U.clear(node);
    return node;
  }

  function run(title) {
    var prev = document.title;
    document.title = title;
    document.body.classList.add('printing');
    var restore = function () {
      document.body.classList.remove('printing');
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1500);
  }

  /** فضای خالی بالای صفحه، به‌اندازهٔ سربرگ چاپی (منهای حاشیهٔ خود کاغذ) */
  function letterheadSpace(c) {
    var sp = el('div.lf-head-space');
    sp.style.height = beyond(c.letterheadTop, PAGE.top) + 'mm';
    return sp;
  }

  /** ردیف دوستونی «برچسب: مقدار» داخل جدول فرم */
  function cell(label, value, cls) {
    return el('td' + (cls ? '.' + cls : ''), null, [
      el('span.lf-k', { text: label }),
      el('span.lf-v', { text: dash(value) })
    ]);
  }

  function personRows(rec, extra) {
    return [
      el('tr', null, [
        cell('نام', rec.firstName),
        cell('نام خانوادگی', rec.lastName),
        cell('نام پدر', rec.fatherName)
      ]),
      el('tr', null, [
        cell('کد ملی', rec.nationalId),
        cell('کد پرسنلی', rec.personnelCode),
        cell('شمارهٔ تماس', rec.phone)
      ]),
      el('tr', null, [
        cell('عنوان شغل فعلی', rec.jobTitle || rec.postTitle),
        cell('مدرک تحصیلی', rec.education),
        cell('واحد سازمانی', rec.orgUnit)
      ]),
      el('tr', null, [
        cell('نوع استخدام', rec.employmentStatus || rec.contractType),
        cell('نام شرکت', extra.company || rec.contractType),
        cell('محل خدمت', rec.servicePlace)
      ])
    ];
  }

  // ==================================================================
  // مدل سند: هر فرم یک بار توصیف می‌شود، و دو رندرکننده از رویش می‌سازند —
  // یکی برای چاپ (HTML) و یکی برای ورد (docx). این‌طور محال است خروجی چاپ و
  // خروجی ورد با هم فرق کنند.
  // ==================================================================

  /** ۱) خلاصهٔ پرونده — کاغذ سفید */
  function docSummary(rec, extra) {
    return {
      key: 'summary', paper: 'plain', title: 'خلاصهٔ پرونده', file: 'kholase',
      blocks: [
        { t: 'h1', text: 'خلاصهٔ پرونده' },
        {
          t: 'labelTable',
          rows: [
            { label: 'نام', value: val(rec.firstName) },
            { label: 'نام خانوادگی', value: val(rec.lastName) },
            { label: 'واحد محل خدمت', value: val(rec.servicePlace || rec.orgUnit) },
            { label: 'نوع قرارداد', value: val(rec.contractType) },
            { label: 'عنوان شغلی', value: val(rec.jobTitle || rec.postTitle) },
            { label: 'سابقهٔ کار در شهرداری', value: val(extra.service) },
            { label: 'تحصیلات', value: val(rec.education) },
            { label: 'سابقهٔ تخلف', value: val(rec.priorRecord) },
            { label: 'مرجع گزارش‌دهنده', value: val(rec.reporterOrg) },
            { label: 'موضوع تخلف', value: val(rec.reportSubject), minMm: 22 },
            { label: 'خلاصهٔ دفاعیه', value: val(rec.defenseSummary), minMm: 42 }
          ]
        }
      ]
    };
  }

  /** ۲) تفهیم اتهام و دفاعیه — سربرگ */
  function docDefense(rec, extra) {
    var c = conf();
    var p = J.unpack(rec.invitationLetterDate || J.today());
    return {
      key: 'defense', paper: 'letterhead', title: 'فرم تفهیم اتهام و دفاعیه',
      file: 'tafhim-etteham',
      blocks: [
        { t: 'h1', text: 'فرم تفهیم اتهام و دفاعیه' },
        { t: 'h2', text: 'دبیرخانهٔ ' + c.orgTitle },
        {
          t: 'kvTable', cols: 4,
          rows: [
            [{ k: 'نام', v: rec.firstName }, { k: 'نام خانوادگی', v: rec.lastName },
              { k: 'نام پدر', v: rec.fatherName },
              { k: 'نوع استخدام', v: rec.employmentStatus }],
            [{ k: 'کد پرسنلی', v: rec.personnelCode }, { k: 'شمارهٔ تماس', v: rec.phone },
              { k: 'مدرک تحصیلی', v: rec.education },
              { k: 'نام شرکت', v: extra.company || rec.contractType }],
            [{ k: 'کد ملی', v: rec.nationalId },
              { k: 'عنوان شغل فعلی', v: rec.jobTitle || rec.postTitle },
              { k: 'واحد سازمانی', v: rec.orgUnit }, { k: 'محل خدمت', v: rec.servicePlace }],
            [{
              k: 'مدت سابقهٔ کار در شهرداری تهران',
              v: dots(extra.service) + '  از تاریخ ' + dots(extra.serviceFrom) +
                '  تا تاریخ ' + dots(extra.serviceTo), span: 4
            }],
            [{ k: 'آدرس محل سکونت', v: dots(extra.address), span: 4 }],
            [{ k: 'شمارهٔ تلفن ثابت', v: dots(extra.phoneFixed), span: 2 },
              { k: 'شمارهٔ تماس ضروری (بستگان)', v: dots(extra.phoneKin), span: 2 }]
          ]
        },
        {
          t: 'p', bold: true,
          text: 'در تاریخ ' + (p ? J.format(J.pack(p.jy, p.jm, p.jd)) : '   /   /    ') +
            ' به دبیرخانهٔ کمیتهٔ انضباط کار دعوت و پس از تفهیم علت حضور، دفاعیات ' +
            'خود را به شرح ذیل اعلام می‌نمایند.'
        },
        {
          t: 'box', minMm: 88,
          head: 'با عنایت به نامهٔ شمارهٔ ' + dash(rec.letterNo) + ' مورخ ' +
            (rec.letterDate ? J.format(rec.letterDate) : '—') + ' ' +
            dash(rec.reporterOrg) + ' در خصوص شما مبنی بر «' +
            (val(rec.reportSubject) || '—') + '»، دفاعیات خود را کتباً اعلام نمایید.',
          foot: ['نام و نام خانوادگی', 'امضاء', 'تاریخ']
        }
      ]
    };
  }

  /** ۳) رأی صادره — سربرگ */
  function docVerdict(rec, extra) {
    var c = conf();
    var members = c.members.filter(function (m) { return val(m.name) || val(m.role); });
    return {
      key: 'verdict', paper: 'letterhead', title: 'رأی کمیتهٔ انضباط کار',
      file: 'ray',
      blocks: [
        { t: 'h1', text: c.orgTitle },
        { t: 'h2', mark: true, text: '» رأی صادره «' },
        {
          t: 'p',
          text: 'جلسهٔ کمیتهٔ انضباط کار شهرداری تهران در تاریخ ' +
            (rec.committeeDate ? J.format(rec.committeeDate) : '..........') +
            ' با حضور اعضاء جهت رسیدگی به اتهام/اتهامات پرسنل ذیل تشکیل گردید.'
        },
        {
          t: 'kvTable', cols: 3,
          rows: [
            [{ k: 'نام', v: rec.firstName }, { k: 'نام خانوادگی', v: rec.lastName },
              { k: 'نام پدر', v: rec.fatherName }],
            [{ k: 'کد ملی', v: rec.nationalId },
              { k: 'کد پرسنلی', v: rec.personnelCode },
              { k: 'شمارهٔ تماس', v: rec.phone }],
            [{ k: 'عنوان شغل فعلی', v: rec.jobTitle || rec.postTitle },
              { k: 'مدرک تحصیلی', v: rec.education },
              { k: 'واحد سازمانی', v: rec.orgUnit }],
            [{ k: 'نوع استخدام', v: rec.employmentStatus || rec.contractType },
              { k: 'نام شرکت', v: extra.company || rec.contractType },
              { k: 'محل خدمت', v: rec.servicePlace }],
            [{ k: 'موضوع', v: rec.reportSubject, span: 3 }]
          ]
        },
        { t: 'h3', text: 'گردش کار:' },
        {
          t: 'p', justify: true,
          text: 'پس از ملاحظهٔ مدارک و مستندات موجود در پرونده و با توجه به مفاد ' +
            'مندرج در ' + c.regulation + ' و بر اساس نامهٔ شمارهٔ ' + dash(rec.letterNo) +
            ' مورخ ' + (rec.letterDate ? J.format(rec.letterDate) : '—') + ' ' +
            dash(rec.reporterOrg) + '، اتهام/اتهامات فوق به نامبرده تفهیم و اعضاء پس ' +
            'از مطالعه و بررسی محتویات پرونده، شواهد و قرائن موجود، مبادرت به صدور و ' +
            'اعلام رأی به شرح ذیل می‌نماید.'
        },
        {
          t: 'box', minMm: 18, head: 'متن رأی',
          body: val(extra.verdictText) || val(rec.verdictFull),
          note: 'این رأی قطعی و لازم‌الاجرا می‌باشد.'
        },
        { t: 'members', items: members, cols: 4 },
        {
          t: 'lines',
          items: [
            'نام و نام خانوادگی ابلاغ‌شونده: ....................................' +
              '      امضاء ....................................',
            'نام و نام خانوادگی مأمور ابلاغ: ....................................' +
              '      امضاء ....................................',
            'محل ابلاغ (سکونت / کار): ....................................' +
              '      تاریخ ابلاغ ....................................'
          ]
        }
      ]
    };
  }

  /** ۴) ابلاغ رأی — سربرگ */
  function docNotice(rec, extra) {
    var c = conf();
    var person = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    var honor = (rec.gender === 'زن') ? 'خانم' : 'آقای';
    return {
      key: 'notice', paper: 'letterhead', title: 'ابلاغ رأی', file: 'eblagh-ray',
      blocks: [
        {
          t: 'letterNo',
          text: val(extra.outLetterNo) || val(rec.noticeLetterNo)
        },
        {
          t: 'to',
          lines: [
            'جناب ' + (val(extra.addressee) ? 'آقای ' + extra.addressee : 'آقای ...'),
            val(extra.addresseeRole) || 'شهردار محترم ...',
            'موضوع: ابلاغ رأی کمیتهٔ انضباط کار شهرداری تهران'
          ]
        },
        { t: 'p', text: 'با سلام و احترام؛' },
        {
          t: 'p', justify: true,
          text: 'بازگشت به نامهٔ شمارهٔ ' + dash(rec.letterNo) + ' مورخ ' +
            (rec.letterDate ? J.format(rec.letterDate) : '—') + '، در خصوص ' + honor +
            ' ' + (person || '...') + ' (کد ملی: ' + dash(rec.nationalId) + ')، از ' +
            'کارکنان طرف قرارداد ' + dash(rec.contractType) + ' شاغل در آن ' +
            dash(rec.orgUnit) + ' به آگاهی می‌رساند؛'
        },
        {
          t: 'p', justify: true,
          text: 'موضوع تخلف نامبرده در جلسهٔ مورخ ' +
            (rec.committeeDate ? J.format(rec.committeeDate) : '...') +
            ' کمیتهٔ انضباط کار شهرداری تهران مطرح و منتج به صدور رأی به شمارهٔ ' +
            dash(rec.committeeRegNo) + ' به شرح ذیل گردید:'
        },
        {
          t: 'quote',
          text: '«' + (val(extra.verdictText) || val(rec.verdictFull) || '...') + '»'
        },
        {
          t: 'p', justify: true,
          text: 'لذا شایسته است دستور فرمایید ضمن اخذ تعهد از نامبرده (فرم پیوست)، ' +
            'نسبت به ابلاغ رأی و اخذ رسید از ایشان اقدام و تصویر نسخه‌ای از رأی ' +
            'مذکور به نامبرده تحویل و اصل نسخهٔ رأی را به منظور درج در پروندهٔ ' +
            'اتهامی مشارالیه در اسرع وقت به این اداره کل ارسال نمایند.'
        },
        {
          t: 'p', justify: true, bold: true,
          text: 'شایان ذکر است ارسال اصل رأی صادره پس از ابلاغ به نامبرده جهت درج ' +
            'در پروندهٔ اتهامی ایشان به دبیرخانهٔ کمیتهٔ انضباط کار الزامی می‌باشد.'
        },
        { t: 'signer', name: dots(c.signerName), role: val(c.signerRole) },
        c.cc.length ? { t: 'list', head: 'رونوشت:', items: c.cc } : null,
        val(c.preparedBy) ? { t: 'small', text: 'تهیه‌کننده: ' + c.preparedBy } : null
      ].filter(Boolean)
    };
  }

  var BUILDERS = {
    summary: docSummary, defense: docDefense, verdict: docVerdict, notice: docNotice
  };

  // --------------------------------------------------- رندر HTML برای چاپ
  function toHtml(doc) {
    var c = conf();
    var wrap = el('div.lf.' + (doc.paper === 'letterhead' ? 'lf-letterhead' : 'lf-plain'));
    if (doc.paper === 'letterhead') {
      // نوار کنارِ سربرگ سمت راست است؛ متن باید از آن فاصله بگیرد.
      wrap.style.paddingInlineEnd = beyond(c.letterheadRight, PAGE.side) + 'mm';
      wrap.appendChild(letterheadSpace(c));
    }

    doc.blocks.forEach(function (b) {
      if (b.t === 'h1') wrap.appendChild(el('h1.lf-title', { text: b.text }));
      else if (b.t === 'h2') {
        wrap.appendChild(el(b.mark ? 'h2.lf-verdict-mark' : 'h2.lf-subtitle',
          { text: b.text }));
      }
      else if (b.t === 'h3') wrap.appendChild(el('h3.lf-h3', { text: b.text }));
      else if (b.t === 'p') {
        wrap.appendChild(el('p.lf-para' + (b.justify ? '.lf-justify' : '') +
          (b.bold ? '.lf-bold' : ''), { text: b.text }));
      } else if (b.t === 'quote') {
        wrap.appendChild(el('blockquote.lf-quote', { text: b.text }));
      } else if (b.t === 'letterNo') {
        wrap.appendChild(el('div.lf-letter-no', { text: b.text }));
      } else if (b.t === 'to') {
        wrap.appendChild(el('div.lf-to', null, b.lines.map(function (line, i) {
          return el(i === 2 ? 'div.lf-subject' : 'div', { text: line });
        })));
      } else if (b.t === 'labelTable') {
        var t1 = el('table.lf-summary');
        b.rows.forEach(function (r) {
          var tr = el('tr' + (r.minMm ? '.lf-tall' : ''), null, [
            el('th', { text: r.label }), el('td', { text: r.value })
          ]);
          if (r.minMm) tr.querySelector('td').style.height = r.minMm + 'mm';
          t1.appendChild(tr);
        });
        wrap.appendChild(t1);
      } else if (b.t === 'kvTable') {
        var t2 = el('table.lf-grid');
        b.rows.forEach(function (row) {
          t2.appendChild(el('tr', null, row.map(function (kv) {
            var td = el('td' + (kv.span ? '.lf-wide' : ''),
              kv.span ? { colspan: String(kv.span) } : null, [
                el('span.lf-k', { text: kv.k }),
                el('span.lf-v', { text: dash(kv.v) })
              ]);
            return td;
          })));
        });
        wrap.appendChild(t2);
      } else if (b.t === 'box') {
        var box = el('div.' + (b.body != null ? 'lf-verdict-box' : 'lf-box'));
        if (b.head) {
          box.appendChild(el(b.body != null ? 'div.lf-k' : 'p.lf-box-head',
            { text: b.head }));
        }
        if (b.body != null) box.appendChild(el('p.lf-verdict-text', { text: b.body }));
        if (b.minMm && b.body == null) {
          var blank = el('div.lf-blank');
          blank.style.height = b.minMm + 'mm';
          box.appendChild(blank);
        }
        if (b.note) box.appendChild(el('p.lf-final', { text: b.note }));
        if (b.foot) {
          box.appendChild(el('div.lf-sign-row', null, b.foot.map(function (x) {
            return el('span', { text: x });
          })));
        }
        wrap.appendChild(box);
      } else if (b.t === 'members') {
        wrap.appendChild(el('div.lf-members', null, b.items.map(function (mb) {
          return el('div.lf-member', null, [
            el('div.lf-member-name', { text: dots(mb.name) }),
            el('div.lf-member-role', { text: val(mb.role) })
          ]);
        })));
      } else if (b.t === 'lines') {
        wrap.appendChild(el('div.lf-notice', null, b.items.map(function (x) {
          return el('div.lf-notice-row', { text: x });
        })));
      } else if (b.t === 'signer') {
        wrap.appendChild(el('div.lf-signer', null, [
          el('div.lf-signer-name', { text: b.name }),
          el('div.lf-signer-role', { text: b.role })
        ]));
      } else if (b.t === 'list') {
        wrap.appendChild(el('div.lf-foot', null, [
          el('div.lf-cc', null, [
            el('div.lf-cc-head', { text: b.head }),
            el('ul.lf-cc-list', null, b.items.map(function (x) {
              return el('li', { text: x });
            }))
          ])
        ]));
      } else if (b.t === 'small') {
        wrap.appendChild(el('div.lf-prepared', { text: b.text }));
      }
    });
    return wrap;
  }

  // ------------------------------------------------------ رندر docx برای ورد
  function toDocx(doc) {
    var D = w.Docx;
    var c = conf();
    var out = [];

    doc.blocks.forEach(function (b) {
      if (b.t === 'h1') {
        out.push(D.para(b.text, { bold: true, size: 26, align: 'center', after: 100 }));
      } else if (b.t === 'h2') {
        out.push(D.para(b.text, { bold: true, size: 24, align: 'center', after: 140 }));
      } else if (b.t === 'h3') {
        out.push(D.para(b.text, { bold: true, after: 60 }));
      } else if (b.t === 'p') {
        out.push(D.para(b.text, {
          bold: b.bold, align: b.justify ? 'both' : 'right', after: 120
        }));
      } else if (b.t === 'quote') {
        out.push(D.para(b.text, { bold: true, align: 'both', border: true, after: 140 }));
      } else if (b.t === 'letterNo') {
        out.push(D.para(b.text, { align: 'left', after: 160 }));
      } else if (b.t === 'to') {
        b.lines.forEach(function (line) {
          out.push(D.para(line, { bold: true, after: 40 }));
        });
        out.push(D.emptyPara({ after: 80 }));
      } else if (b.t === 'labelTable') {
        out.push(D.table(b.rows.map(function (r) {
          return [
            D.cell([{ text: r.label, bold: true }], { width: 2600 }),
            D.cell(r.value || '', { width: 7000, minMm: r.minMm })
          ];
        }), 2));
      } else if (b.t === 'kvTable') {
        out.push(D.table(b.rows.map(function (row) {
          return row.map(function (kv) {
            return D.cell([
              { text: kv.k + ': ', bold: true },
              { text: dash(kv.v) }
            ], { span: kv.span, size: 20 });
          });
        }), b.cols));
      } else if (b.t === 'box') {
        out.push(D.table([
          [D.cell(b.head ? [{ text: b.head, bold: true }] : '', {})],
          [D.cell(b.body != null ? String(b.body) : '', { minMm: b.minMm })],
          b.note ? [D.cell([{ text: b.note, bold: true }], {})] : null,
          b.foot ? [D.cell(b.foot.map(function (x, i) {
            return { text: (i ? '        ' : '') + x, bold: true };
          }), {})] : null
        ].filter(Boolean), 1));
      } else if (b.t === 'members') {
        var rows = [], line = [];
        b.items.forEach(function (mb, i) {
          line.push(D.cell([
            { text: dots(mb.name) + '\n', bold: true },
            { text: val(mb.role) }
          ], {}));
          if (line.length === (b.cols || 4) || i === b.items.length - 1) {
            while (line.length < (b.cols || 4)) line.push(D.cell('', {}));
            rows.push(line);
            line = [];
          }
        });
        if (rows.length) out.push(D.table(rows, b.cols || 4, { noBorder: true }));
      } else if (b.t === 'lines') {
        out.push(D.emptyPara({ after: 120 }));
        b.items.forEach(function (x) {
          out.push(D.para(x, { bold: true, size: 20, after: 140 }));
        });
      } else if (b.t === 'signer') {
        out.push(D.emptyPara({ after: 400 }));
        out.push(D.para(b.name, { bold: true, align: 'center', after: 20 }));
        out.push(D.para(b.role, { align: 'center', after: 200 }));
      } else if (b.t === 'list') {
        out.push(D.para(b.head, { bold: true, size: 17, after: 20 }));
        b.items.forEach(function (x) {
          out.push(D.para('– ' + x, { size: 17, after: 10 }));
        });
      } else if (b.t === 'small') {
        out.push(D.para(b.text, { size: 17, after: 0 }));
      }
    });

    var head = doc.paper === 'letterhead';
    return D.build(out.join(''), {
      topMm: head ? c.letterheadTop : 16,
      bottomMm: head ? c.letterheadBottom : 14,
      sideMm: PAGE.side,
      // در ورد، w:right همان لبهٔ راستِ فیزیکی کاغذ است — جای نوار سربرگ.
      rightMm: head ? c.letterheadRight : PAGE.side
    });
  }

  // ------------------------------------------------------------- خروجی‌ها
  function printForm(kind, rec, extra) {
    var doc = BUILDERS[kind](rec, extra || {});
    var node = area();
    node.appendChild(toHtml(doc));
    run(doc.title);
    return doc;
  }

  /* نام فایل لاتین است، نه از سرِ سلیقه: کروم وقتی برنامه از روی فایل
     (file://) باز شده باشد، نام غیرلاتین را دور می‌ریزد و فایل را بی‌پسوند
     «download» ذخیره می‌کند — آن‌وقت ورد بازش نمی‌کند. */
  function wordForm(kind, rec, extra) {
    var doc = BUILDERS[kind](rec, extra || {});
    var caseNo = w.U.toLatinDigits(rec.caseNo || '').replace(/[^\w.-]+/g, '-');
    var name = (doc.file || doc.key) + (caseNo ? '-' + caseNo : '') + '.docx';
    w.U.download(name, toDocx(doc));
    return doc;
  }

  // نام‌های قبلی، برای سازگاری
  function printSummary(rec, extra) { return printForm('summary', rec, extra); }
  function printDefense(rec, extra) { return printForm('defense', rec, extra); }
  function printVerdict(rec, extra) { return printForm('verdict', rec, extra); }
  function printNotice(rec, extra) { return printForm('notice', rec, extra); }

  // ------------------------------------------------------------- پنجره
  var FORMS = [
    {
      key: 'summary', label: 'خلاصهٔ پرونده', paper: 'کاغذ سفید A4',
      hint: 'مشخصات، سابقه، موضوع تخلف و خلاصهٔ دفاعیه در یک جدول',
      fields: ['service']
    },
    {
      key: 'defense', label: 'تفهیم اتهام و دفاعیه', paper: 'سربرگ',
      hint: 'برگهٔ حضور در دبیرخانه، با جای خالی برای نوشتن دفاعیه',
      fields: ['company', 'service', 'serviceFrom', 'serviceTo', 'address',
        'phoneFixed', 'phoneKin']
    },
    {
      key: 'verdict', label: 'رأی صادره', paper: 'سربرگ',
      hint: 'متن رأی با مشخصات، گردش کار، امضای اعضا و محل ابلاغ',
      fields: ['company', 'verdictText']
    },
    {
      key: 'notice', label: 'ابلاغ رأی', paper: 'سربرگ',
      hint: 'نامهٔ ابلاغ به واحد سازمانی، با متن رأی و رونوشت‌ها',
      fields: ['addressee', 'addresseeRole', 'outLetterNo', 'verdictText']
    }
  ];

  var FIELD_LABELS = {
    company: 'نام شرکت',
    service: 'سابقهٔ کار در شهرداری',
    serviceFrom: 'سابقه از تاریخ',
    serviceTo: 'سابقه تا تاریخ',
    address: 'آدرس محل سکونت',
    phoneFixed: 'تلفن ثابت',
    phoneKin: 'تلفن ضروری (بستگان)',
    addressee: 'نام مخاطب نامه',
    addresseeRole: 'سمت مخاطب',
    outLetterNo: 'شمارهٔ نامهٔ صادره',
    verdictText: 'متن رأی'
  };

  /** چیزهایی که در پرونده نیستند، از خود پرونده یا آخرین بار حدس زده می‌شوند */
  function guess(rec, key) {
    if (key === 'company') return rec.contractType || '';
    if (key === 'verdictText') return rec.verdictFull || '';
    if (key === 'addresseeRole') return 'شهردار محترم ' + (rec.orgUnit || '');
    if (key === 'outLetterNo') return rec.noticeLetterNo || '';
    if (key === 'phoneFixed') return rec.phone || '';
    var remembered = (M.state.settings.letterExtras || {})[key];
    return remembered || '';
  }

  /** پنجرهٔ یک فرم: چند فیلدِ باقی‌مانده را می‌پرسد و چاپ می‌کند */
  function formDialog(app, rec, form) {
    var extra = {};
    var inputs = {};
    var body = el('div.letters-form');

    body.appendChild(el('p.muted.tiny', {
      text: form.hint + ' — ' + (form.paper === 'سربرگ'
        ? 'روی سربرگ ساخته می‌شود؛ بالا و سمت راست به‌اندازهٔ تنظیمات خالی می‌ماند.'
        : 'روی کاغذ سفید A4 ساخته می‌شود.')
    }));

    var grid = el('div.letters-grid');
    form.fields.forEach(function (key) {
      extra[key] = guess(rec, key);
      var input;
      if (key === 'verdictText' || key === 'address') {
        input = el('textarea.input.area', { rows: key === 'verdictText' ? '4' : '2' });
      } else {
        input = el('input.input.small', { type: 'text' });
      }
      input.value = extra[key];
      input.addEventListener('input', function () { extra[key] = input.value; });
      inputs[key] = input;
      grid.appendChild(el('label.field' + (key === 'verdictText' ? '.wide' : ''), null, [
        el('span.field-label', { text: FIELD_LABELS[key] || key }),
        input
      ]));
    });
    if (!form.fields.length) {
      grid.appendChild(el('p.muted', { text: 'همه‌چیز از خود پرونده پر می‌شود.' }));
    }
    body.appendChild(grid);

    /** مقدارهای عمومی برای دفعهٔ بعد یادداشت می‌شوند */
    function remember() {
      var keep = {};
      ['service', 'serviceFrom', 'serviceTo', 'addressee', 'addresseeRole']
        .forEach(function (k) { if (extra[k]) keep[k] = extra[k]; });
      if (Object.keys(keep).length) {
        M.saveSettings({
          letterExtras: Object.assign({}, M.state.settings.letterExtras, keep)
        });
      }
    }

    var m = w.U.modal('فرم ' + form.label, body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn', {
        type: 'button', text: 'خروجی ورد',
        title: 'فایل .docx واقعی؛ در ورد باز و ویرایش می‌شود',
        onclick: function () {
          remember();
          m.close();
          setTimeout(function () {
            wordForm(form.key, rec, extra);
            w.U.toast('فایل ورد ساخته شد.', 'good');
          }, 60);
        }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'چاپ فرم',
        onclick: function () {
          remember();
          m.close();
          setTimeout(function () { printForm(form.key, rec, extra); }, 60);
        }
      })
    ]);
    m.root.classList.add('letters-modal');
    return m;
  }

  /** فهرست فرم‌ها برای یک پرونده */
  function chooser(app, rec) {
    if (!rec) {
      w.U.toast('اول پرونده را ذخیره کنید.', 'warn');
      return null;
    }
    return w.Mobile.sheet('فرم‌های پروندهٔ ' + w.U.toLatinDigits(rec.caseNo || ''),
      FORMS.map(function (form) {
        return {
          icon: form.paper === 'سربرگ' ? 'fileText' : 'file',
          label: form.label,
          hint: form.paper + ' — ' + form.hint,
          onclick: function () { formDialog(app, rec, form); }
        };
      }));
  }

  w.UILetters = {
    chooser: chooser, formDialog: formDialog, FORMS: FORMS,
    conf: conf, saveConf: saveConf, DEFAULTS: DEFAULTS,
    printForm: printForm, wordForm: wordForm, toHtml: toHtml, toDocx: toDocx,
    build: function (kind, rec, extra) { return BUILDERS[kind](rec, extra || {}); },
    printSummary: printSummary, printDefense: printDefense,
    printVerdict: printVerdict, printNotice: printNotice
  };
})(window);
