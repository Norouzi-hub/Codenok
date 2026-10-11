/*
 * خواندن پروفایل کارمند از متنِ کپی‌شدهٔ سامانهٔ کارگزینی.
 *
 * صفحهٔ «مشخصات» سامانهٔ منابع انسانی را که انتخاب و کپی کنید، چنین
 * چیزی به دست می‌آید:
 *
 *     نام و نامِ خانوادگی            ← سرِ صفحه، بی‌برچسب
 *     عنوان شغلی / نام شرکت / کد ملی
 *     مشخصات فردی                   ← سربرگِ بخش
 *     کد ملی                        ← برچسب
 *     ۰۰۱۲۳۴۵۶۷۸                    ← مقدار، در سطرِ بعد
 *                                   ← (سطرِ خالی)
 *     واحد سازمانی                  ← برچسبِ بی‌مقدار: سطرِ بعدش
 *     تاریخ استخدام                 ←   خودش برچسب است
 *
 * و اگر از جدول کپی شده باشد، «برچسب<تب>مقدار» یا «برچسب: مقدار» در یک سطر.
 * هر سه شکل خوانده می‌شود.
 *
 * دو قاعده:
 *   ۱) هرچه پرونده جایی برایش ندارد (شمارهٔ حساب، شمارهٔ بیمه، …) خوانده
 *      می‌شود تا با مقدارِ برچسبِ بعدی قاطی نشود، ولی هیچ‌جا نوشته
 *      نمی‌شود. پروندهٔ انضباطی جای شمارهٔ حساب بانکیِ کارمند نیست.
 *   ۲) «تاریخ آخرین حکم کارگزینی» پر نمی‌شود: یک مرحله از گردش‌کار است
 *      (بارگذاری حکم) و پر شدنش یعنی تیک خوردنِ کاری که انجام نشده.
 *      اعتبارِ حکم در فیلدهای خودش می‌نشیند.
 */
(function (w) {
  'use strict';

  var U = w.U;

  /* ------------------------------------------------------- برچسب‌ها */
  /*
   * هر برچسب با چند نامِ رایجش. کلیدِ «vet:» یعنی تکه‌ای از وضعیت
   * ایثارگری که آخر کار در یک فیلد جمع می‌شود.
   */
  var LABELS = [
    ['nationalId', 'کد ملی', 'شماره ملی', 'کدملی'],
    ['firstName', 'نام'],
    ['lastName', 'نام خانوادگی', 'نام فامیلی', 'فامیلی'],
    ['fullName', 'نام و نام خانوادگی', 'نام کامل'],
    ['fatherName', 'نام پدر'],
    ['idNumber', 'شماره شناسنامه', 'شماره شناسنامه ای'],
    ['personnelCode', 'کد پرسنلی', 'شماره پرسنلی', 'شماره کارمندی', 'کد کارمندی'],
    ['gender', 'جنسیت', 'جنس'],
    ['maritalStatus', 'وضعیت تاهل', 'وضعیت تأهل', 'تاهل'],
    ['education', 'مدرک', 'مدرک تحصیلی', 'آخرین مدرک تحصیلی', 'تحصیلات'],
    ['phone', 'شماره تماس', 'شماره همراه', 'تلفن همراه', 'موبایل', 'تلفن'],
    ['birthDate', 'روز تولد', 'تاریخ تولد'],
    ['fieldOfStudy', 'رشته تحصیلی', 'رشته'],
    ['payrollPlace', 'محل پرداخت', 'محل پرداخت حقوق'],
    ['orgUnit', 'واحد سازمانی'],
    ['hireDate', 'تاریخ استخدام', 'تاریخ شروع به کار'],
    ['jobTitle', 'عنوان شغلی', 'نام شغل', 'عنوان شغل'],
    ['jobGrade', 'گروه شغلی', 'رتبه شغلی', 'رتبه'],
    ['servicePlace', 'محل خدمت', 'محل اشتغال'],
    ['employType', 'نوع استخدام'],
    ['contractType', 'نوع قرارداد'],
    ['jobNature', 'ماهیت شغلی', 'ماهیت شغل'],
    ['decreeType', 'نوع حکم'],
    ['decreeStart', 'تاریخ آغاز اعتبار حکم', 'تاریخ شروع اعتبار حکم', 'تاریخ اجرای حکم'],
    ['decreeEnd', 'تاریخ پایان اعتبار حکم', 'تاریخ انقضای حکم'],
    ['vet:janbaz', 'جانباز'],
    ['vet:janbazPct', 'درصد جانبازی'],
    ['vet:azadeh', 'آزاده'],
    ['vet:azadehTime', 'مدت آزادگی', 'مدت اسارت'],
    ['vet:shahidChild', 'فرزند شهید'],
    ['vet:shahidSpouse', 'همسر شهید'],
    ['vet:razmandeh', 'رزمنده'],
    ['vet:razmandehTime', 'مدت رزمندگی', 'مدت حضور در جبهه'],
    ['vet:basiji', 'بسیجی'],
    ['vet:basijTime', 'مدت بسیج'],
    // خوانده می‌شوند، ولی پرونده جایی برایشان ندارد
    ['skip', 'شماره حساب', 'شماره شبا', 'شبا', 'شماره کارت', 'شماره بیمه',
      'جمع روز های بیمه پردازی', 'جمع روزهای بیمه پردازی', 'سابقه بیمه',
      'تعداد فرزندان', 'تعداد اولاد', 'وضعیت خدمت', 'وضعیت نظام وظیفه',
      'مرکز هزینه', 'کد شغل', 'شغل طبقه بندی', 'طبقه بندی شغل', 'آدرس',
      'نشانی', 'کد پستی', 'ایمیل', 'پست الکترونیک', 'محل تولد',
      'محل صدور', 'محل صدور شناسنامه', 'دین', 'مذهب', 'تابعیت', 'ملیت',
      'گروه خونی', 'تلفن ثابت', 'نام همسر', 'شماره پرونده پرسنلی',
      // «نام پست» از پرونده رفت؛ همان «عنوان شغلی» را تکرار می‌کرد
      'عنوان پست', 'نام پست', 'پست سازمانی']
  ];

  /* سربرگ‌هایی که مقدار ندارند و فقط بخش‌ها را جدا می‌کنند */
  var HEADINGS = ['مشخصات', 'خلاصه مشخصات', 'مشخصات عمومی', 'مشخصات فردی',
    'مشخصات بستگان', 'مشخصات استخدامی', 'مشخصات حکمی', 'مشخصات ایثارگری',
    'مشخصات شغلی', 'اطلاعات شغلی', 'اطلاعات فردی', 'اطلاعات پرسنلی',
    'سوابق', 'سوابق تحصیلی', 'سوابق شغلی'];

  /** برچسب برای مقایسه: بی‌فاصله، بی‌نشانه، ی/ک یکدست */
  function squash(s) { return U.normalize(s).replace(/\s+/g, ''); }

  var BY_LABEL = {}, HEADING = {}, LONGEST = 1;
  LABELS.forEach(function (row) {
    row.slice(1).forEach(function (name) {
      BY_LABEL[squash(name)] = { key: row[0], name: name };
      LONGEST = Math.max(LONGEST, U.normalize(name).split(' ').length);
    });
  });
  HEADINGS.forEach(function (h) { HEADING[squash(h)] = true; });

  /* نامِ نمایشیِ تکه‌های ایثارگری */
  var VET_NAME = {
    janbaz: 'جانباز', azadeh: 'آزاده', shahidChild: 'فرزند شهید',
    shahidSpouse: 'همسر شهید', razmandeh: 'رزمنده', basiji: 'بسیجی'
  };
  var VET_EXTRA = {
    janbaz: ['janbazPct', 'درصد'], azadeh: ['azadehTime', 'مدت'],
    razmandeh: ['razmandehTime', 'مدت'], basiji: ['basijTime', 'مدت']
  };

  /* ---------------------------------------------------- تکه‌کردن سطر */
  /*
   * هر سطر به واژه‌های اصلی‌اش. واژه‌ای که چیزی جز نشانه نیست («-»، «:»)
   * کنار گذاشته می‌شود، ولی متنِ اصلی دست نمی‌خورد — مقدار باید همان‌طور
   * که در سامانه بود بماند، با پرانتز و عددش.
   */
  function words(line) {
    return line.split(/\s+/).filter(Boolean).map(function (raw) {
      return { raw: raw, n: squash(raw) };
    }).filter(function (t) { return t.n; });
  }

  /** آیا سطر با یک برچسبِ شناخته شروع می‌شود؟ بلندترین تطابق برنده است. */
  function labelAt(line) {
    var t = words(line);
    if (!t.length) return null;
    for (var k = Math.min(LONGEST + 1, t.length); k >= 1; k--) {
      var key = t.slice(0, k).map(function (x) { return x.n; }).join('');
      var hit = BY_LABEL[key];
      if (hit) {
        var rest = t.slice(k).map(function (x) { return x.raw; }).join(' ');
        // «کد ملی: ۰۰۱…» — دونقطه یا خط تیرهٔ چسبیده به مقدار
        rest = rest.replace(/^[:：\-–—]+\s*/, '').trim();
        return { key: hit.key, name: hit.name, rest: rest, exact: k === t.length };
      }
    }
    return null;
  }

  function isHeading(line) { return !!HEADING[squash(line)]; }

  /** خالی از دید ما: «null» و «-» و امثالشان، که سامانه جای خالی می‌گذارد */
  function clean(v) {
    v = String(v == null ? '' : v)
      .replace(/(^|\s)(null|undefined|nan)(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    if (/^[-–—_.]+$/.test(v)) return '';
    return v;
  }

  /* --------------------------------------------------- مقدارِ هر فیلد */
  var ALIASES = {
    gender: { 'مرد': 'مرد', 'زن': 'زن', 'آقا': 'مرد', 'خانم': 'زن', 'مذکر': 'مرد', 'مونث': 'زن', 'مؤنث': 'زن' },
    maritalStatus: { 'متاهل': 'متاهل', 'مجرد': 'مجرد', 'معیل': 'معیل' },
    education: {
      'کارشناسی': 'لیسانس', 'کارشناسیارشد': 'فوق لیسانس', 'ارشد': 'فوق لیسانس',
      'کاردانی': 'فوق دیپلم', 'دیپلم': 'دیپلم', 'سیکل': 'زیر دیپلم',
      'لیسانس': 'لیسانس', 'فوقلیسانس': 'فوق لیسانس', 'فوقدیپلم': 'فوق دیپلم',
      'زیردیپلم': 'زیر دیپلم'
    },
    jobNature: { 'کارمندی': 'کارمندی', 'کارمند': 'کارمندی', 'کارگری': 'کارگری', 'کارگر': 'کارگری' }
  };

  // کلیدهای هم‌معنا هم مثل خودِ متن یکدست می‌شوند («آقا» → «اقا»)
  var ALIAS_N = {};
  Object.keys(ALIASES).forEach(function (k) {
    ALIAS_N[k] = {};
    Object.keys(ALIASES[k]).forEach(function (a) { ALIAS_N[k][squash(a)] = ALIASES[k][a]; });
  });
  function aliasOf(key, squashed) { return ALIAS_N[key] ? ALIAS_N[key][squashed] : undefined; }

  function fieldOf(key) { return w.Model.FIELD_BY_KEY[key] || null; }

  /** گزینهٔ هم‌معنا در فهرستِ همان فیلد؛ وگرنه null */
  function optionFor(key, value) {
    var f = fieldOf(key);
    if (!f || f.type !== 'select') return null;
    var want = squash(value);
    var alias = aliasOf(key, want);
    var opts = w.Model.optionsFor(f) || [];
    for (var i = 0; i < opts.length; i++) {
      var o = squash(opts[i]);
      if (o === want || (alias && o === squash(alias))) return opts[i];
    }
    return alias || null;
  }

  var DIGITS_ONLY = { nationalId: 1, idNumber: 1, personnelCode: 1, phone: 1 };

  /**
   * مقدارِ خام → مقداری که در پرونده می‌نشیند.
   * برمی‌گرداند: { value, note, bad }  — bad یعنی پیش‌فرض تیک نخورد.
   */
  function shape(key, raw) {
    var v = clean(raw);
    if (!v) return { value: '' };
    var f = fieldOf(key);
    if (f && f.type === 'date') {
      var d = w.J.parse(v);
      if (/^\d{8}$/.test(d)) return { value: d };
      return { value: v, note: 'تاریخ خوانا نبود؛ دستی درستش کنید', bad: true };
    }
    if (DIGITS_ONLY[key]) {
      var digits = U.toLatinDigits(v).replace(/[\s\-–]/g, '');
      return { value: digits };
    }
    if (f && f.type === 'select') {
      var opt = optionFor(key, v);
      if (opt) return { value: opt };
      return { value: v, note: 'در فهرستِ این فیلد نیست؛ همین‌طور اضافه می‌شود' };
    }
    return { value: v };
  }

  /* ------------------------------------------------------------ نام */
  /*
   * «محمد رضا احمدی» نامِ «محمدرضا» است یا نام خانوادگیِ «رضا احمدی»؟
   * از متن نمی‌شود فهمید. قاعدهٔ ساده و پیش‌بینی‌پذیر: واژهٔ اول نام است،
   * مگر پیشوندی رایج باشد یا جفتِ آشنایی بسازد. پیش‌نمایش ویرایش‌پذیر
   * است، پس اشتباهِ نادرش با یک تایپ درست می‌شود.
   */
  var NAME_PREFIX = { 'سید': 1, 'سیده': 1, 'میر': 1, 'شیخ': 1 };
  var NAME_FIRST = { 'محمد': 1, 'علی': 1, 'امیر': 1, 'ابو': 1, 'فاطمه': 1, 'زهرا': 1, 'حسین': 1 };
  var NAME_SECOND = {
    'رضا': 1, 'علی': 1, 'حسین': 1, 'حسن': 1, 'مهدی': 1, 'جواد': 1, 'امین': 1,
    'صادق': 1, 'باقر': 1, 'کاظم': 1, 'تقی': 1, 'هادی': 1, 'اکبر': 1, 'اصغر': 1,
    'جعفر': 1, 'سعید': 1, 'حمید': 1, 'مجید': 1, 'محمد': 1, 'سادات': 1,
    'السادات': 1, 'الفضل': 1, 'القاسم': 1, 'عباس': 1, 'رسول': 1, 'مصطفی': 1
  };

  function splitName(full) {
    var t = clean(full).split(' ').filter(Boolean);
    if (!t.length) return null;
    if (t.length === 1) return { firstName: t[0], lastName: '' };
    var n = 1;
    var a = squash(t[0]), b = squash(t[1] || '');
    if (t.length > 2 && (NAME_PREFIX[a] || (NAME_FIRST[a] && NAME_SECOND[b]))) n = 2;
    return { firstName: t.slice(0, n).join(' '), lastName: t.slice(n).join(' ') };
  }

  /** سطری که شبیه نامِ آدم است: بی‌رقم، دو تا چهار واژه، نه سربرگ و نه برچسب */
  function looksLikeName(line) {
    if (/[0-9۰-۹]/.test(line) || /[()\/:]/.test(line)) return false;
    var t = clean(line).split(' ');
    if (t.length < 2 || t.length > 4) return false;
    return !isHeading(line) && !labelAt(line);
  }

  /* ---------------------------------------------------------- خواندن */
  /**
   * برمی‌گرداند:
   *   rows    — [{ key, value, from, note, bad, inferred }] به ترتیبِ فرم
   *   skipped — نامِ برچسب‌هایی که خوانده شدند و نوشته نمی‌شوند
   *   unknown — سطرهایی که معلوم نشد چیستند
   *   count   — چند فیلدِ پرونده از این متن درمی‌آید
   */
  function parse(text) {
    // سطرهای جدول (با تب) هر خانه یک سطر می‌شوند: برچسب، مقدار، برچسب، …
    var lines = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (l) {
      l.split('\t').forEach(function (cell) { lines.push(cell.trim()); });
    });

    var found = {};       // key → { raw, from }
    var vet = {};         // تکه‌های ایثارگری
    var skipped = [], unknown = [], header = [];
    var seenLabel = false;

    function put(key, raw, from) {
      if (key === 'skip') {
        // برچسبِ بی‌مقدار (مثل «آدرس» که در سامانه نامِ یک زبانه هم هست) گفتن ندارد
        if (clean(raw) && skipped.indexOf(from) < 0) skipped.push(from);
        return;
      }
      if (key.indexOf('vet:') === 0) { vet[key.slice(4)] = clean(raw); return; }
      if (found[key] && clean(found[key].raw)) return;   // اولی برنده است
      found[key] = { raw: raw, from: from };
    }

    function nextValue(i) {
      // سطرِ بعدیِ ناخالی؛ اگر خودش برچسب یا سربرگ است، این برچسب خالی بوده
      for (var j = i + 1; j < lines.length; j++) {
        if (!lines[j]) continue;
        var lab = labelAt(lines[j]);
        if ((lab && lab.exact) || isHeading(lines[j])) return { value: '', at: i };
        return { value: lines[j], at: j };
      }
      return { value: '', at: i };
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      if (isHeading(line)) { seenLabel = true; continue; }
      var lab = labelAt(line);
      if (lab) {
        seenLabel = true;
        if (lab.exact) {
          var nv = nextValue(i);
          put(lab.key, nv.value, lab.name);
          i = nv.at;
        } else {
          put(lab.key, lab.rest, lab.name);
        }
        continue;
      }
      if (!seenLabel) header.push(line);
      else unknown.push(line);
    }

    var values = {}, meta = {};
    Object.keys(found).forEach(function (k) {
      var s = shape(k === 'fullName' ? 'firstName' : k, found[k].raw);
      if (!s.value) return;
      if (k === 'fullName') {
        var nm = splitName(s.value);
        if (!nm) return;
        ['firstName', 'lastName'].forEach(function (p) {
          if (nm[p] && !values[p]) { values[p] = nm[p]; meta[p] = { from: found[k].from }; }
        });
        return;
      }
      values[k] = s.value;
      meta[k] = { from: found[k].from, note: s.note, bad: s.bad };
    });

    /* ---- سرِ صفحه: نام، نام شرکت، و کد ملی اگر برچسب‌دارش نیامده بود */
    header.forEach(function (line) {
      // نام شرکت هم چهار واژهٔ بی‌رقم است؛ پیش از «نامِ آدم» آزموده می‌شود
      var opt = optionFor('contractType', line);
      if (opt && squash(opt) === squash(line)) {
        if (!values.contractType) {
          values.contractType = opt;
          meta.contractType = { from: 'نام شرکت در سرِ صفحه', inferred: true };
        }
        return;
      }
      if (!values.firstName && !values.lastName && looksLikeName(line)) {
        var nm = splitName(line);
        if (nm) {
          values.firstName = nm.firstName;
          meta.firstName = { from: 'سرِ صفحه', inferred: true };
          if (nm.lastName) {
            values.lastName = nm.lastName;
            meta.lastName = { from: 'سرِ صفحه', inferred: true };
          }
        }
        return;
      }
      var d = U.toLatinDigits(line).replace(/\s/g, '');
      if (/^\d{10}$/.test(d) && !values.nationalId) {
        values.nationalId = d;
        meta.nationalId = { from: 'سرِ صفحه', inferred: true };
      }
    });

    /* ---- نوع قرارداد از محل پرداخت، اگر نام یکی از گزینه‌ها باشد */
    if (!values.contractType && values.payrollPlace) {
      var cp = optionFor('contractType', values.payrollPlace);
      if (cp && squash(cp) === squash(values.payrollPlace)) {
        values.contractType = cp;
        meta.contractType = { from: 'محل پرداخت', inferred: true };
      }
    }

    /* ---- نوع محل خدمت: «شهرداری منطقهٔ …» یعنی «مناطق» */
    if (values.servicePlace && !values.servicePlaceType &&
        /منطقه/.test(U.normalize(values.servicePlace))) {
      var sp = optionFor('servicePlaceType', 'مناطق');
      if (sp) {
        values.servicePlaceType = sp;
        meta.servicePlaceType = { from: 'محل خدمت', inferred: true };
      }
    }

    /* ---- ایثارگری: یک سطرِ خوانا، بی آن‌که واحدی از خودمان بسازیم */
    var vetKeys = Object.keys(vet);
    if (vetKeys.length) {
      var yes = /^(بله|دارد|هست|بلی|yes|true|1)$/i;
      var items = [];
      Object.keys(VET_NAME).forEach(function (k) {
        var extra = VET_EXTRA[k];
        var amount = extra ? clean(vet[extra[0]]) : '';
        var hasAmount = amount && !/^0+([.,]0+)?$/.test(U.toLatinDigits(amount));
        if (!yes.test(squash(vet[k] || '')) && !hasAmount) return;
        items.push(VET_NAME[k] + (hasAmount ? ' (' + extra[1] + ': ' + amount + ')' : ''));
      });
      values.veteran = items.length ? items.join('، ') : 'ندارد';
      meta.veteran = { from: 'مشخصات ایثارگری' };
    }

    // هیچ‌وقت: مرحلهٔ گردش‌کار است
    delete values.decreeDate;

    var rows = [];
    (w.Model.FIELDS || []).forEach(function (f) {
      if (values[f.key] === undefined) return;
      var m = meta[f.key] || {};
      rows.push({
        key: f.key, value: values[f.key], from: m.from || '',
        note: m.note || '', bad: !!m.bad, inferred: !!m.inferred
      });
    });

    return { rows: rows, values: values, skipped: skipped, unknown: unknown, count: rows.length };
  }

  /**
   * آیا این متن پروفایل است؟ برای چسباندنِ مستقیم در فرم: متنِ چندسطری
   * که دست‌کم سه فیلد از آن درمی‌آید، یک مقدار نیست که در یک خانه بنشیند.
   */
  function looksLikeProfile(text) {
    var s = String(text || '');
    if (s.split(/\n|\t/).filter(function (l) { return l.trim(); }).length < 4) return false;
    return parse(s).count >= 3;
  }

  w.Paste = {
    parse: parse, looksLikeProfile: looksLikeProfile,
    splitName: splitName, labelAt: labelAt, squash: squash
  };
})(window);
