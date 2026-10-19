/*
 * مینوت نامه — متنی که در اتوماسیون اداری تایپ می‌شد، حالا از خودِ پرونده.
 *
 * نامه‌های دبیرخانه پنج تکه دارند و فقط یکی‌شان مالِ نوعِ نامه است:
 *
 *   با سلام و احترام؛
 *   ① جملهٔ ارجاع   — بازگشت به / پیرو / با عنایت به … (محرمانه: هیچ)
 *   ② فعل درخواست   — مقتضی / شایسته / خواهشمند است دستور فرمایید
 *   ③ معرفی کارمند  — آقای/خانم … از کارکنان … شاغل در آن …
 *   ④ متنِ خاصِ نامه — مهلت، ساعت و محل جلسه، فهرست مدارک، قطع پرداخت
 *   ⑤ بندهای ثابت    — «بدیهی است…»، «شایان ذکر است…»، تبصرهٔ ۳۰ مادهٔ ۳۶
 *
 * قاعده‌ها (از خودِ دبیرخانه):
 *   - فعل از رتبهٔ گیرنده: پایین‌دست «مقتضی است»، همتراز «شایسته است»،
 *     بالادست «خواهشمند است».
 *   - ارجاع از جنسِ نامهٔ قبلی: نامهٔ خودِ گیرنده «بازگشت به» (عطف)، نامهٔ
 *     خودمان «پیرو» (پیرو)، هر نامهٔ دیگر «با عنایت به» (در ارتباط).
 *   - نامه شماره دارد (از اتوماسیون آمده)؟ شماره نوشته می‌شود؛ ندارد؟ فقط
 *     تاریخ.
 *   - محرمانه: بی‌ارجاع، مستقیم سرِ درخواست.
 *
 * این فایل فقط متن می‌سازد؛ پنجره و ثبتش در ui.minute.js است.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model, U = w.U;

  /* جای خالی: شش نقطه، مثل فرم‌های چاپی. «...» نیست، چون خودِ متنِ ثابت
     («استعفاء و ...») سه نقطه دارد و هشدارِ «جای خالی» را گیج می‌کرد. */
  var BLANK = '......';

  function fa(s) { return U.toFaDigits(String(s == null ? '' : s).trim()); }
  function date(v) { return v && J.unpack(v) ? J.format(v) : ''; }
  function norm(s) { return U.normalize(s || '').replace(/\s+/g, ''); }

  /* ------------------------------------------------------------ رتبه */
  var RANKS = [
    { key: 'low', label: 'پایین‌دست', verb: 'مقتضی است' },
    { key: 'peer', label: 'همتراز', verb: 'شایسته است' },
    { key: 'high', label: 'بالادست', verb: 'خواهشمند است' }
  ];
  function verbOf(rank) {
    var r = RANKS.filter(function (x) { return x.key === rank; })[0];
    return (r || RANKS[1]).verb;
  }

  /* ------------------------------------------------------- نوع ارتباط */
  var RELATIONS = [
    { key: 'atf', label: 'عطف', lead: 'بازگشت به', line: 'عطف به' },
    { key: 'peyro', label: 'پیرو', lead: 'پیرو', line: 'پیرو' },
    { key: 'related', label: 'در ارتباط', lead: 'با عنایت به', line: 'در ارتباط با' }
  ];
  function relOf(key) {
    return RELATIONS.filter(function (r) { return r.key === key; })[0] || RELATIONS[2];
  }

  /* ------------------------------------------------------- گیرنده‌ها */
  /*
   * kind:
   *   employer  — کارفرمای قرارداد (شرکت، موسسه): «از کارکنان قراردادی آن شرکت»
   *   workplace — جایی که کارمند کار می‌کند: «… شاغل در آن منطقه»
   * match: اگر «نوع قرارداد» پرونده این باشد، همین گیرنده پیشنهاد می‌شود.
   * {منطقه} و {محل خدمت} از خودِ پرونده پر می‌شوند.
   */
  var DEFAULT_RECIPIENTS = [
    { id: 'khadamat', title: 'مدیرعامل محترم شرکت خدمات اداری شهر', rank: 'low',
      kind: 'employer', unit: 'شرکت', match: 'شرکت خدمات اداری شهر' },
    { id: 'hadian', title: 'مدیرعامل محترم موسسهٔ هادیان شهر', rank: 'low',
      kind: 'employer', unit: 'موسسه', match: 'موسسه هادیان شهر' },
    { id: 'region', title: 'معاون محترم مالی و اداری شهرداری {منطقه}', rank: 'peer',
      kind: 'workplace', unit: 'منطقه', match: '' },
    { id: 'mayor', title: 'شهردار محترم {منطقه}', rank: 'high',
      kind: 'workplace', unit: 'منطقه', match: '' },
    { id: 'deputy', title: 'معاون محترم شهردار تهران', rank: 'high',
      kind: 'workplace', unit: 'معاونت', match: '' }
  ];

  var DEFAULT_DOCS = [
    'فرم اعلام تخلف شمارهٔ ۱',
    'صورتجلسهٔ شورای عملیاتی تحول اداری',
    'پرینت تردد ایام غیبت'
  ];

  var DEFAULTS = {
    recipients: DEFAULT_RECIPIENTS,
    rulesNo: '1091348',
    rulesDate: '14020925',
    hearingTime: '14:00',
    hearingPlace: 'شهرداری منطقهٔ یک',
    docs: DEFAULT_DOCS
  };

  function conf() {
    var saved = (M.state.settings || {}).minutes || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = saved[k];
      out[k] = (v != null && v !== '' && !(Array.isArray(v) && !v.length)) ? v : DEFAULTS[k];
    });
    return out;
  }

  function saveConf(patch) {
    return M.saveSettings({ minutes: Object.assign({}, conf(), patch) });
  }

  /** «شهرداری منطقه پنج» → «منطقه پنج» */
  function regionOf(rec) {
    var s = String((rec && rec.servicePlace) || '').trim();
    return s.replace(/^شهرداری\s+/, '') || BLANK;
  }

  function titleFor(recipient, rec) {
    return String(recipient.title || '')
      .replace(/\{منطقه\}/g, regionOf(rec))
      .replace(/\{محل خدمت\}/g, (rec && rec.servicePlace) || BLANK);
  }

  /** گیرندهٔ پیشنهادی: کارفرمای قرارداد، وگرنه محل خدمت (همتراز) */
  function suggestRecipient(rec) {
    var list = conf().recipients;
    var ct = norm(rec && rec.contractType);
    var hit = ct && list.filter(function (r) { return r.match && norm(r.match) === ct; })[0];
    if (hit) return hit;
    return list.filter(function (r) { return r.kind === 'workplace' && r.rank === 'peer'; })[0] ||
      list[0];
  }

  /* ---------------------------------------------------- معرفی کارمند */
  var COMPANY = { 'شرکتخدماتاداریشهر': 'شرکت', 'موسسههادیانشهر': 'موسسه' };

  function honor(rec) { return rec.gender === 'زن' ? 'خانم' : 'آقای'; }
  function nameOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ').trim() || BLANK;
  }

  /** «آقای … و خانم …» / «آقایان … و …» */
  function people(recs) {
    if (recs.length === 1) return honor(recs[0]) + ' ' + nameOf(recs[0]);
    var men = recs.every(function (r) { return r.gender !== 'زن'; });
    var women = recs.every(function (r) { return r.gender === 'زن'; });
    var names = recs.map(nameOf);
    var joined = names.slice(0, -1).join('، ') + ' و ' + names[names.length - 1];
    if (men) return 'آقایان ' + joined;
    if (women) return 'خانم‌ها ' + joined;
    return recs.map(function (r) { return honor(r) + ' ' + nameOf(r); }).slice(0, -1).join('، ') +
      ' و ' + honor(recs[recs.length - 1]) + ' ' + nameOf(recs[recs.length - 1]);
  }

  /** «از کارکنان …» — بسته به اینکه نامه به کارفرما می‌رود یا به محل خدمت */
  function staffOf(rec, recipient) {
    var ct = String(rec.contractType || '').trim();
    var company = COMPANY[norm(ct)];
    var unit = recipient.unit || 'مجموعه';
    if (company) {
      return recipient.kind === 'employer'
        ? 'از کارکنان قراردادی آن ' + company
        : 'از کارکنان طرف قرارداد ' + ct + ' شاغل در آن ' + unit;
    }
    if (/مدت معین/.test(ct)) return 'از کارکنان قرارداد مدت معین آن ' + unit;
    if (/دائم/.test(ct)) return 'از کارکنان قرارداد دائم آن ' + unit;
    if (/رسمی/.test(ct)) return 'از کارکنان رسمی (کارگری) شاغل در آن ' + unit;
    return 'از کارکنان شاغل در آن ' + unit;
  }

  function intro(recs, recipient, withNid) {
    var who = people(recs);
    if (withNid && recs.length === 1 && recs[0].nationalId) {
      who += ' (کد ملی: ' + fa(recs[0].nationalId) + ')';
    }
    return who + ' ' + staffOf(recs[0], recipient);
  }

  /* ---------------------------------------------------------- ارجاع */
  /*
   * ref: { source, no, date, from, relation, copy }
   *   source: 'case' (نامهٔ گزارش پرونده) | 'ours:<کلید>' | 'custom' | 'none'
   *   relation: 'auto' | 'atf' | 'peyro' | 'related'
   */
  var OUR_LETTERS = [
    { key: 'invitation', label: 'نامهٔ دعوت به کمیته', no: 'invitationLetterNo', date: 'invitationLetterDate' },
    { key: 'defect', label: 'نامهٔ تکمیل مستندات', no: 'defectLetterNo', date: 'defectLetterDate' },
    { key: 'salaryStop', label: 'نامهٔ بستن حقوق', no: 'salaryStopLetterNo', date: 'salaryStopLetterDate' },
    { key: 'hearing', label: 'نامهٔ دعوت به جلسه', no: 'hearingLetterNo', date: 'hearingLetterDate' },
    { key: 'securityOut', label: 'استعلام حراست', no: 'securityOutLetterNo', date: 'securityOutLetterDate' }
  ];

  /** نامهٔ مرجع، از روی منبعش */
  function refLetter(rec, ref) {
    ref = ref || {};
    var src = ref.source || 'case';
    if (src === 'none') return null;
    if (src === 'custom') {
      return { no: ref.no || '', date: J.parse(ref.date || ''), from: ref.from || '', ours: !!ref.ours };
    }
    if (src.indexOf('ours:') === 0) {
      var l = OUR_LETTERS.filter(function (x) { return 'ours:' + x.key === src; })[0];
      if (!l) return null;
      return { no: rec[l.no] || '', date: rec[l.date] || '', from: '', ours: true, label: l.label };
    }
    return { no: rec.letterNo || '', date: rec.letterDate || '', from: rec.reporterOrg || '', ours: false };
  }

  /** عطف، پیرو یا در ارتباط — اگر کاربر خودش نگفته باشد */
  function relationFor(letter, recipient, rec, ref) {
    if (ref && ref.relation && ref.relation !== 'auto') return ref.relation;
    if (!letter) return '';
    if (letter.ours) return 'peyro';
    if (ref && ref.copy) return 'related';
    var from = norm(letter.from);
    var to = norm(titleFor(recipient, rec)) + norm(recipient.match);
    if (from && (to.indexOf(from) >= 0 || (norm(recipient.match) && from.indexOf(norm(recipient.match)) >= 0))) {
      return 'atf';
    }
    return 'related';
  }

  /** «نامهٔ شمارهٔ … مورخ …» — بی‌شماره، فقط تاریخ */
  function letterPhrase(letter) {
    var bits = [];
    if (letter.no) bits.push('شمارهٔ ' + fa(letter.no));
    if (letter.date) bits.push('مورخ ' + date(letter.date));
    return 'نامهٔ ' + (bits.join(' ') || BLANK);
  }

  function refClause(letter, relation, ref, recipient) {
    if (!letter) return '';
    var rel = relOf(relation);
    var phrase = (ref && ref.copy ? 'رونوشت ' : '') + letterPhrase(letter);
    // «با عنایت به نامهٔ … نهاد …» — فرستنده فقط وقتی گیرنده نیست، گفته می‌شود
    if (relation === 'related' && letter.from && !letter.ours) phrase += ' ' + letter.from;
    return rel.lead + ' ' + phrase;
  }

  /* -------------------------------------------------- بندهای ثابت */
  function pron(recs) { return recs.length > 1 ? 'نامبردگان' : 'نامبرده'; }

  function noExit(recs) {
    return 'بدیهی است هرگونه خروج از خدمت ' + pron(recs) + ' (بازنشستگی، بازخرید، ' +
      'استعفاء و ...) تا صدور رأی کمیتهٔ انضباط کار امکان‌پذیر نمی‌باشد.';
  }
  var VERDICT_LATER = 'شایان ذکر است رأی کمیتهٔ انضباط کار متعاقباً ارسال خواهد شد.';
  var NOTE_30 = '((شایان ذکر است برابر تبصرهٔ ۳۰ مادهٔ ۳۶ آیین‌نامهٔ انضباط کار، هرگونه ' +
    'خودداری یا جلوگیری از ابلاغ یا اجرای تصمیمات کمیته ممنوع بوده و با متخلفان طبق ' +
    'تخلف مندرج در مادهٔ ۱۴ طبقهٔ ۲ ردیف ۳۵ مقررات آیین‌نامهٔ مذکور رفتار خواهد شد)).';

  function appear(due) {
    return 'حداکثر تا تاریخ ' + (date(due) || BLANK) + ' به دبیرخانهٔ کمیتهٔ انضباط کار مستقر ' +
      'در این اداره کل مراجعه و ضمن تکمیل فرم دعوت به کمیتهٔ انضباط کار (به پیوست)، نتیجه ' +
      'را به همراه مستندات لازم به این اداره کل ارسال نمایند.';
  }

  /** روز کاریِ پیش از جلسه، برای مهلتِ تصویر پیامک (جمعه و پنج‌شنبه نه) */
  function dayBefore(d) {
    var x = J.addDays(d, -1);
    for (var i = 0; i < 3 && x; i++) {
      var p = J.unpack(x);
      var wd = J.weekdayIndex(p.jy, p.jm, p.jd);
      if (wd !== 5 && wd !== 6) break;
      x = J.addDays(x, -1);
    }
    return x;
  }
  function weekdayOf(d) {
    var p = J.unpack(d);
    return p ? J.weekday(p.jy, p.jm, p.jd) : BLANK;
  }

  /* ---------------------------------------------------- نوع‌های نامه */
  /*
   * هر نوع: opts پیش‌فرض از خودِ پرونده، و body که پاراگراف‌ها را می‌سازد.
   * caseNo / caseDate: فیلدهای پرونده که شمارهٔ نامهٔ صادره در آن ثبت می‌شود.
   */
  var TYPES = [
    {
      key: 'invite', label: 'دعوت به کمیته', subject: 'دعوت به کمیتهٔ انضباط کار',
      attach: 'فرم دعوت به کمیتهٔ انضباط کار',
      caseNo: 'invitationLetterNo', caseDate: 'invitationLetterDate',
      defaults: function (rec) {
        return { due: rec.defenseDueDate || '', about: '' };
      },
      body: function (x) {
        var s = x.lead + 'دستور فرمایید به ' + x.intro + '، ابلاغ گردد ' +
          (x.opts.about ? 'جهت ادای توضیح در ارتباط با ' + x.opts.about + '، ' : '') +
          appear(x.opts.due);
        return [s + ' ' + noExit(x.recs) + ' ' + VERDICT_LATER];
      }
    },
    {
      key: 'hearing', label: 'دعوت به جلسهٔ کمیته', subject: 'دعوت به جلسهٔ کمیتهٔ انضباط کار',
      attach: 'فرم دعوت به جلسه',
      caseNo: 'hearingLetterNo', caseDate: 'hearingLetterDate',
      defaults: function (rec, c) {
        var d = rec.committeeDate || '';
        return {
          meetDate: d, time: c.hearingTime, place: c.hearingPlace,
          proofDate: d ? dayBefore(d) : ''
        };
      },
      body: function (x) {
        var o = x.opts;
        var many = x.recs.length > 1;
        return [
          x.lead + 'دستور فرمایید ' + x.intro + '، راس ساعت ' + fa(o.time || BLANK) + ' روز ' +
            weekdayOf(o.meetDate) + ' مورخ ' + (date(o.meetDate) || BLANK) +
            ' در جلسهٔ کمیتهٔ انضباط کار، که در ' + (o.place || BLANK) +
            ' برگزار می‌شود، حضور به عمل رسانند. ضمناً نسبت به تکمیل و ارسال فرم دعوت به ' +
            'جلسهٔ ' + pron(x.recs) + ' و مستندات لازم مندرج در فرم پیوست اقدام لازم به عمل آورند.',
          'بدیهی است در صورت عدم حضور ' + pron(x.recs) + ' در واحد محل خدمتی، مراتب به صورت ' +
            'تماس تلفنی و ارسال پیامک دعوت به جلسه، به شمارهٔ همراه ' + (many ? 'ایشان' : 'وی') +
            ' ارسال و تصویر آن را حداکثر تا پایان وقت اداری روز ' + weekdayOf(o.proofDate) +
            ' مورخ ' + (date(o.proofDate) || BLANK) + ' به این اداره کل ارسال نمایند.',
          NOTE_30
        ];
      }
    },
    {
      key: 'defect', label: 'تکمیل مستندات', subject: 'تکمیل مستندات پرونده',
      caseNo: 'defectLetterNo', caseDate: 'defectLetterDate',
      defaults: function (rec, c) {
        return {
          about: rec.caseType === 'غیبت' ? 'اعلام غیبت' : 'اعلام تخلف',
          docs: c.docs.slice(), withInvite: false, due: rec.defenseDueDate || '',
          withNid: true
        };
      },
      attachOf: function (o) { return o.withInvite ? 'فرم شمارهٔ ۴ دعوت به کمیتهٔ انضباط کار' : ''; },
      body: function (x) {
        var o = x.opts, c = x.conf;
        var about = 'در خصوص ' + o.about + ' ' + intro(x.recs, x.recipient, o.withNid);
        var rules = 'با عنایت به ابلاغ آیین‌نامهٔ کمیتهٔ انضباط کار به شمارهٔ ' + fa(c.rulesNo) +
          ' مورخ ' + date(c.rulesDate);
        var docs = (o.docs || []).filter(Boolean);
        var ask = 'نسبت به ارسال مدارک و مستندات' +
          (docs.length ? ' (' + docs.join('، ') + ')' : ' لازم') + '، اقدام لازم معمول نمایند.';
        var s = x.ref
          ? x.ref + ' ' + about + ' و ' + rules + '، ' + x.verb + ' دستور فرمایید ' + ask
          : rules + '، ' + x.verb + ' دستور فرمایید ' + about + ' ' + ask;
        if (o.withInvite) {
          s += ' همچنین ضمن تکمیل فرم شمارهٔ ۴ دعوت به کمیتهٔ انضباط کار (به پیوست) به ' +
            pron(x.recs) + ' ابلاغ گردد حداکثر تا تاریخ ' + (date(o.due) || BLANK) +
            ' به کمیتهٔ انضباط کار، مستقر در این اداره کل مراجعه نمایند.';
        }
        return [s, 'بدیهی است در صورت عدم وصول مستندات لازم، اقدامی جهت طرح و رسیدگی در ' +
          'کمیتهٔ انضباط کار میسر نمی‌باشد.'];
      }
    },
    {
      key: 'salaryStop', label: 'بستن حقوق', subject: 'خودداری از پرداخت وجه',
      caseNo: 'salaryStopLetterNo', caseDate: 'salaryStopLetterDate',
      defaults: function (rec) {
        return {
          about: rec.caseType === 'غیبت' ? 'اعلام غیبت' : 'اعلام تخلف',
          withInvite: true, due: rec.defenseDueDate || ''
        };
      },
      attachOf: function (o) { return o.withInvite ? 'تصویر فرم دعوت به کمیتهٔ انضباط کار' : ''; },
      body: function (x) {
        var o = x.opts;
        var about = 'در خصوص ' + o.about + ' ' + intro(x.recs, x.recipient, false);
        var head = (x.ref ? x.ref + ' ' + about + '، ' + x.verb + ' دستور فرمایید'
          : x.verb + ' دستور فرمایید در خصوص ' + o.about + ' ' + intro(x.recs, x.recipient, false) + '،');
        var s = o.withInvite
          ? head + ' ضمن خودداری از پرداخت هرگونه وجه، به ' + pron(x.recs) + ' ابلاغ گردد ' +
            appear(o.due).replace('(به پیوست)', '(تصویر پیوست)')
          : head + ' از پرداخت هرگونه وجه به ' + pron(x.recs) + ' خودداری نمایند.';
        return [s + ' ' + noExit(x.recs) + ' ' + VERDICT_LATER];
      }
    }
  ];

  function typeOf(key) { return TYPES.filter(function (t) { return t.key === key; })[0] || TYPES[0]; }

  /**
   * ساختن یک مینوت.
   *   type      — کلید نوع نامه
   *   recs      — یک یا چند پرونده (اولی مبنای گیرنده و نامهٔ مرجع است)
   *   o.recipient, o.ref, o.confidential, o.opts (گزینه‌های خاصِ نوع)
   * برمی‌گرداند: { type, to, subject, relation, relationText, attach,
   *               paragraphs, text, full }
   */
  function build(typeKey, recs, o) {
    o = o || {};
    var t = typeOf(typeKey);
    var c = conf();
    var rec = recs[0] || {};
    var recipient = o.recipient || suggestRecipient(rec);
    var opts = Object.assign({}, t.defaults(rec, c), o.opts || {});
    var conf_ = !!o.confidential;
    var letter = conf_ ? null : refLetter(rec, o.ref);
    if (letter && !letter.no && !letter.date) letter = null;
    var relation = letter ? relationFor(letter, recipient, rec, o.ref) : '';
    var ref = letter ? refClause(letter, relation, o.ref, recipient) : '';
    var verb = verbOf(recipient.rank);
    var x = {
      recs: recs, recipient: recipient, opts: opts, conf: c, ref: ref, verb: verb,
      intro: intro(recs, recipient, false),
      // «بازگشت به …، شایسته است » — ارجاع و فعل، با ویرگولِ میانشان
      lead: (ref ? ref + '، ' : '') + verb + ' '
    };
    /* «ٔ» (نامهٔ، شمارهٔ) در قلمِ B Zar نیست و در ورد و اتوماسیون دایرهٔ خالی
       می‌شود؛ نامه‌های دبیرخانه «نامه شماره» می‌نویسند. */
    var paragraphs = ['با سلام و احترام؛'].concat(t.body(x)).map(plain);
    var relationText = plain(conf_ ? 'محرمانه — بدون ارجاع'
      : (letter ? relOf(relation).line + ' ' + letterPhrase(letter) : 'بدون ارجاع'));
    var attach = plain(t.attachOf ? t.attachOf(opts) : (t.attach || ''));
    /* نامِ مخاطب از «دفتر مقامات»: «جناب آقای … شهردار محترم منطقه ۵».
       withName: false یعنی فقط سمت (کاربر خواسته، یا نامی پیدا نشد). */
    var title = titleFor(recipient, rec);
    var addressee = null;
    if (o.withName !== false && w.Officials) {
      addressee = recipient.official ? w.Officials.get(recipient.official) : w.Officials.find(title);
    }
    var to = plain(addressee ? w.Officials.address(addressee, title) : title);
    var subject = plain(t.subject + ' — ' + people(recs));
    var text = paragraphs.join('\n');
    var full = ['گیرنده: ' + to, 'موضوع: ' + subject, relationText,
      attach ? 'پیوست: ' + attach : ''].filter(Boolean).join('\n') + '\n\n' + text;
    return {
      type: t, to: to, title: title, addressee: addressee, subject: subject, relation: relation, relationText: relationText,
      attach: attach, letter: letter, recipient: recipient, opts: opts,
      paragraphs: paragraphs, text: text, full: full, confidential: conf_
    };
  }

  function plain(s) { return String(s == null ? '' : s).replace(/\u0654/g, '').replace(/\u06C0/g, '\u0647'); }

  w.Minute = {
    BLANK: BLANK, TYPES: TYPES, RANKS: RANKS, RELATIONS: RELATIONS, OUR_LETTERS: OUR_LETTERS,
    DEFAULTS: DEFAULTS, conf: conf, saveConf: saveConf, typeOf: typeOf,
    suggestRecipient: suggestRecipient, titleFor: titleFor, verbOf: verbOf,
    refLetter: refLetter, relationFor: relationFor, people: people, staffOf: staffOf,
    dayBefore: dayBefore, build: build
  };
})(window);
