/*
 * فرم‌های اداری: همان برگه‌هایی که تا امروز دستی تایپ می‌شدند.
 *
 * چهار فرم، دقیقاً با چیدمان نمونه‌های خود دبیرخانه:
 *   ۱) خلاصهٔ پرونده        — روی کاغذ سفید A4
 *   ۲) تفهیم اتهام و دفاعیه — روی کاغذ سفید A4
 *   ۳) رأی صادره            — روی سربرگ
 *   ۴) ابلاغ رأی            — روی سربرگ
 *
 * «روی سربرگ» یعنی بالای صفحه خالی می‌ماند تا روی کاغذ چاپیِ سازمان بنشیند؛
 * اندازهٔ این فضا در تنظیمات قابل تغییر است، چون سربرگ هر اداره فرق دارد.
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
    letterheadTop: 45,          // میلی‌متر فضای خالی برای سربرگ چاپی
    letterheadBottom: 25,
    signerName: '',
    signerRole: 'مدیر کل',
    preparedBy: '',
    regulation: 'آیین‌نامهٔ انضباط کار مصوب ۱۴۰۲/۰۵/۰۸ وزارت تعاون، کار و رفاه اجتماعی',
    members: DEFAULT_MEMBERS,
    cc: DEFAULT_CC
  };

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

  /** فضای خالی بالای صفحه، به‌اندازهٔ سربرگ چاپی */
  function letterheadSpace(c) {
    var sp = el('div.lf-head-space');
    sp.style.height = (c.letterheadTop || 0) + 'mm';
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

  // ------------------------------------------------- ۱) خلاصهٔ پرونده
  function printSummary(rec, extra) {
    var c = conf();
    var node = area();
    var rows = [
      ['نام', rec.firstName],
      ['نام خانوادگی', rec.lastName],
      ['واحد محل خدمت', rec.servicePlace || rec.orgUnit],
      ['نوع قرارداد', rec.contractType],
      ['عنوان شغلی', rec.jobTitle || rec.postTitle],
      ['سابقهٔ کار در شهرداری', extra.service],
      ['تحصیلات', rec.education],
      ['سابقهٔ تخلف', rec.priorRecord],
      ['مرجع گزارش‌دهنده', rec.reporterOrg],
      ['موضوع تخلف', rec.reportSubject],
      ['خلاصهٔ دفاعیه', rec.defenseSummary]
    ];
    var table = el('table.lf-summary');
    rows.forEach(function (r, i) {
      var tall = i >= 9;          // موضوع تخلف و خلاصهٔ دفاعیه، جای نوشتن دارند
      table.appendChild(el('tr' + (tall ? '.lf-tall' : ''), null, [
        el('th', { text: r[0] }),
        el('td', { text: val(r[1]) })
      ]));
    });
    node.appendChild(el('div.lf.lf-plain', null, [
      el('h1.lf-title', { text: 'خلاصهٔ پرونده' }),
      table
    ]));
    run('خلاصهٔ پرونده');
  }

  // ------------------------------------------- ۲) تفهیم اتهام و دفاعیه
  function printDefense(rec, extra) {
    var c = conf();
    var node = area();
    var p = J.unpack(rec.invitationLetterDate || J.today());
    var table = el('table.lf-grid', null, [
      el('tr', null, [
        cell('نام', rec.firstName), cell('نام خانوادگی', rec.lastName),
        cell('نام پدر', rec.fatherName), cell('نوع استخدام', rec.employmentStatus)
      ]),
      el('tr', null, [
        cell('کد پرسنلی', rec.personnelCode), cell('شمارهٔ تماس', rec.phone),
        cell('مدرک تحصیلی', rec.education),
        cell('نام شرکت', extra.company || rec.contractType)
      ]),
      el('tr', null, [
        cell('کد ملی', rec.nationalId),
        cell('عنوان شغل فعلی', rec.jobTitle || rec.postTitle),
        cell('واحد سازمانی', rec.orgUnit), cell('محل خدمت', rec.servicePlace)
      ]),
      el('tr', null, [
        el('td.lf-wide', { colspan: '4' }, [
          el('span.lf-k', { text: 'مدت سابقهٔ کار در شهرداری تهران' }),
          el('span.lf-v', { text: dots(extra.service) }),
          el('span.lf-k', { text: ' از تاریخ' }),
          el('span.lf-v', { text: dots(extra.serviceFrom) }),
          el('span.lf-k', { text: ' تا تاریخ' }),
          el('span.lf-v', { text: dots(extra.serviceTo) })
        ])
      ]),
      el('tr', null, [
        el('td.lf-wide', { colspan: '4' }, [
          el('span.lf-k', { text: 'آدرس محل سکونت' }),
          el('span.lf-v.lf-line', { text: dots(extra.address) })
        ])
      ]),
      el('tr', null, [
        el('td.lf-wide', { colspan: '2' }, [
          el('span.lf-k', { text: 'شمارهٔ تلفن ثابت' }),
          el('span.lf-v', { text: dots(extra.phoneFixed) })
        ]),
        el('td.lf-wide', { colspan: '2' }, [
          el('span.lf-k', { text: 'شمارهٔ تماس ضروری (بستگان)' }),
          el('span.lf-v', { text: dots(extra.phoneKin) })
        ])
      ])
    ]);

    node.appendChild(el('div.lf.lf-plain', null, [
      el('h1.lf-title', { text: 'فرم تفهیم اتهام و دفاعیه' }),
      el('h2.lf-subtitle', { text: 'دبیرخانهٔ ' + c.orgTitle }),
      table,
      el('p.lf-para', {
        text: 'در تاریخ ' + (p ? J.format(J.pack(p.jy, p.jm, p.jd)) : '   /   /    ') +
          ' به دبیرخانهٔ کمیتهٔ انضباط کار دعوت و پس از تفهیم علت حضور، دفاعیات ' +
          'خود را به شرح ذیل اعلام می‌نمایند.'
      }),
      el('div.lf-box', null, [
        el('p.lf-box-head', {
          text: 'با عنایت به نامهٔ شمارهٔ ' + dash(rec.letterNo) + ' مورخ ' +
            (rec.letterDate ? J.format(rec.letterDate) : '—') + ' ' +
            dash(rec.reporterOrg) + ' در خصوص شما مبنی بر «' +
            (val(rec.reportSubject) || '—') + '»، دفاعیات خود را کتباً اعلام نمایید.'
        }),
        el('div.lf-blank'),
        el('div.lf-sign-row', null, [
          el('span', { text: 'نام و نام خانوادگی' }),
          el('span', { text: 'امضاء' }),
          el('span', { text: 'تاریخ' })
        ])
      ])
    ]));
    run('تفهیم اتهام و دفاعیه');
  }

  // ------------------------------------------------------ ۳) رأی صادره
  function printVerdict(rec, extra) {
    var c = conf();
    var node = area();
    var members = c.members.filter(function (m) { return val(m.name) || val(m.role); });

    var grid = el('table.lf-grid', null, personRows(rec, extra).concat([
      el('tr', null, [
        el('td.lf-wide', { colspan: '3' }, [
          el('span.lf-k', { text: 'موضوع' }),
          el('span.lf-v', { text: dash(rec.reportSubject) })
        ])
      ])
    ]));

    var body = el('div.lf.lf-letterhead', null, [
      letterheadSpace(c),
      el('h1.lf-title', { text: c.orgTitle }),
      el('h2.lf-verdict-mark', { text: '» رأی صادره «' }),
      el('p.lf-para', {
        text: 'جلسهٔ کمیتهٔ انضباط کار شهرداری تهران در تاریخ ' +
          (rec.committeeDate ? J.format(rec.committeeDate) : '..........') +
          ' با حضور اعضاء جهت رسیدگی به اتهام/اتهامات پرسنل ذیل تشکیل گردید.'
      }),
      grid,
      el('h3.lf-h3', { text: 'گردش کار:' }),
      el('p.lf-para.lf-justify', {
        text: 'پس از ملاحظهٔ مدارک و مستندات موجود در پرونده و با توجه به مفاد مندرج ' +
          'در ' + c.regulation + ' و بر اساس نامهٔ شمارهٔ ' + dash(rec.letterNo) +
          ' مورخ ' + (rec.letterDate ? J.format(rec.letterDate) : '—') + ' ' +
          dash(rec.reporterOrg) + '، اتهام/اتهامات فوق به نامبرده تفهیم و اعضاء پس از ' +
          'مطالعه و بررسی محتویات پرونده، شواهد و قرائن موجود، مبادرت به صدور و اعلام ' +
          'رأی به شرح ذیل می‌نماید.'
      }),
      el('div.lf-verdict-box', null, [
        el('div.lf-k', { text: 'متن رأی' }),
        el('p.lf-verdict-text', { text: val(extra.verdictText) || val(rec.verdictFull) }),
        el('p.lf-final', { text: 'این رأی قطعی و لازم‌الاجرا می‌باشد.' })
      ]),
      el('div.lf-members', null, members.map(function (mb) {
        return el('div.lf-member', null, [
          el('div.lf-member-name', { text: dots(mb.name) }),
          el('div.lf-member-role', { text: val(mb.role) })
        ]);
      })),
      el('div.lf-notice', null, [
        el('div.lf-notice-row', {
          text: 'نام و نام خانوادگی ابلاغ‌شونده: ....................................' +
            '      امضاء ....................................'
        }),
        el('div.lf-notice-row', {
          text: 'نام و نام خانوادگی مأمور ابلاغ: ....................................' +
            '      امضاء ....................................'
        }),
        el('div.lf-notice-row', {
          text: 'محل ابلاغ (سکونت / کار): ....................................' +
            '      تاریخ ابلاغ ....................................'
        })
      ])
    ]);
    node.appendChild(body);
    run('رأی کمیتهٔ انضباط کار');
  }

  // ------------------------------------------------------ ۴) ابلاغ رأی
  function printNotice(rec, extra) {
    var c = conf();
    var node = area();
    var person = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    var honor = (rec.gender === 'زن') ? 'خانم' : 'آقای';

    var body = el('div.lf.lf-letterhead', null, [
      letterheadSpace(c),
      el('div.lf-letter-no', {
        text: val(extra.outLetterNo) || (rec.noticeLetterNo || '')
      }),
      el('div.lf-to', null, [
        el('div', { text: 'جناب ' + (val(extra.addressee) ? 'آقای ' + extra.addressee : 'آقای ...') }),
        el('div', { text: val(extra.addresseeRole) || 'شهردار محترم ...' }),
        el('div.lf-subject', {
          text: 'موضوع: ابلاغ رأی کمیتهٔ انضباط کار شهرداری تهران'
        })
      ]),
      el('p.lf-para', { text: 'با سلام و احترام؛' }),
      el('p.lf-para.lf-justify', {
        text: 'بازگشت به نامهٔ شمارهٔ ' + dash(rec.letterNo) + ' مورخ ' +
          (rec.letterDate ? J.format(rec.letterDate) : '—') + '، در خصوص ' + honor +
          ' ' + (person || '...') + ' (کد ملی: ' + dash(rec.nationalId) + ')، از کارکنان ' +
          'طرف قرارداد ' + dash(rec.contractType) + ' شاغل در آن ' +
          dash(rec.orgUnit) + ' به آگاهی می‌رساند؛'
      }),
      el('p.lf-para.lf-justify', {
        text: 'موضوع تخلف نامبرده در جلسهٔ مورخ ' +
          (rec.committeeDate ? J.format(rec.committeeDate) : '...') +
          ' کمیتهٔ انضباط کار شهرداری تهران مطرح و منتج به صدور رأی به شمارهٔ ' +
          dash(rec.committeeRegNo) + ' به شرح ذیل گردید:'
      }),
      el('blockquote.lf-quote', {
        text: '«' + (val(extra.verdictText) || val(rec.verdictFull) || '...') + '»'
      }),
      el('p.lf-para.lf-justify', {
        text: 'لذا شایسته است دستور فرمایید ضمن اخذ تعهد از نامبرده (فرم پیوست)، ' +
          'نسبت به ابلاغ رأی و اخذ رسید از ایشان اقدام و تصویر نسخه‌ای از رأی مذکور ' +
          'به نامبرده تحویل و اصل نسخهٔ رأی را به منظور درج در پروندهٔ اتهامی ' +
          'مشارالیه در اسرع وقت به این اداره کل ارسال نمایند.'
      }),
      el('p.lf-para.lf-bold', {
        text: 'شایان ذکر است ارسال اصل رأی صادره پس از ابلاغ به نامبرده جهت درج در ' +
          'پروندهٔ اتهامی ایشان به دبیرخانهٔ کمیتهٔ انضباط کار الزامی می‌باشد.'
      }),
      el('div.lf-signer', null, [
        el('div.lf-signer-name', { text: dots(c.signerName) }),
        el('div.lf-signer-role', { text: val(c.signerRole) })
      ]),
      // رونوشت و تهیه‌کننده یک بلوک‌اند تا نصفه‌نصفه بین دو صفحه نیفتند
      el('div.lf-foot', null, [
        c.cc.length ? el('div.lf-cc', null, [
          el('div.lf-cc-head', { text: 'رونوشت:' }),
          el('ul.lf-cc-list', null, c.cc.map(function (line) {
            return el('li', { text: line });
          }))
        ]) : null,
        val(c.preparedBy) ? el('div.lf-prepared', {
          text: 'تهیه‌کننده: ' + c.preparedBy
        }) : null
      ])
    ]);
    node.appendChild(body);
    run('ابلاغ رأی');
  }

  // ------------------------------------------------------------- پنجره
  var FORMS = [
    {
      key: 'summary', label: 'خلاصهٔ پرونده', paper: 'کاغذ سفید A4',
      hint: 'مشخصات، سابقه، موضوع تخلف و خلاصهٔ دفاعیه در یک جدول',
      fn: printSummary, fields: ['service']
    },
    {
      key: 'defense', label: 'تفهیم اتهام و دفاعیه', paper: 'کاغذ سفید A4',
      hint: 'برگهٔ حضور در دبیرخانه، با جای خالی برای نوشتن دفاعیه',
      fn: printDefense,
      fields: ['company', 'service', 'serviceFrom', 'serviceTo', 'address',
        'phoneFixed', 'phoneKin']
    },
    {
      key: 'verdict', label: 'رأی صادره', paper: 'سربرگ',
      hint: 'متن رأی با مشخصات، گردش کار، امضای اعضا و محل ابلاغ',
      fn: printVerdict, fields: ['company', 'verdictText']
    },
    {
      key: 'notice', label: 'ابلاغ رأی', paper: 'سربرگ',
      hint: 'نامهٔ ابلاغ به واحد سازمانی، با متن رأی و رونوشت‌ها',
      fn: printNotice,
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
        ? 'روی سربرگ چاپ می‌شود؛ بالای صفحه به‌اندازهٔ تنظیمات خالی می‌ماند.'
        : 'روی کاغذ سفید A4 چاپ می‌شود.')
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

    var m = w.U.modal('چاپ ' + form.label, body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'چاپ فرم',
        onclick: function () {
          // مقدارهای عمومی برای دفعهٔ بعد یادداشت می‌شوند
          var remember = {};
          ['service', 'serviceFrom', 'serviceTo', 'addressee', 'addresseeRole']
            .forEach(function (k) {
              if (extra[k]) remember[k] = extra[k];
            });
          if (Object.keys(remember).length) {
            M.saveSettings({
              letterExtras: Object.assign({}, M.state.settings.letterExtras, remember)
            });
          }
          m.close();
          setTimeout(function () { form.fn(rec, extra); }, 60);
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
    printSummary: printSummary, printDefense: printDefense,
    printVerdict: printVerdict, printNotice: printNotice
  };
})(window);
