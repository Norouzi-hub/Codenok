/*
 * لایهٔ «شخص»: یک کارمند ممکن است چند پرونده داشته باشد.
 * پرونده‌ها بر پایهٔ کد ملی (و در نبودش کد پرسنلی) به یک شخص گره می‌خورند.
 */
(function (w) {
  'use strict';

  var M = w.Model, J = w.J;

  /** فیلدهای هویتی که باید بین پرونده‌های یک شخص یکسان باشند */
  var IDENTITY_FIELDS = [
    { key: 'firstName', label: 'نام' },
    { key: 'lastName', label: 'نام خانوادگی' },
    { key: 'fatherName', label: 'نام پدر' },
    { key: 'idNumber', label: 'شماره شناسنامه' },
    { key: 'personnelCode', label: 'کد پرسنلی' },
    { key: 'gender', label: 'جنسیت' }
  ];

  /** فیلدهایی که با آخرین پرونده به‌روز می‌شوند (شغلی/سازمانی) */
  var PROFILE_FIELDS = ['postTitle', 'jobTitle', 'jobGrade', 'jobNature',
    'payrollPlace', 'orgUnit', 'servicePlace', 'servicePlaceType',
    'contractType', 'employmentStatus', 'education', 'maritalStatus', 'phone'];

  /**
   * کلید یکتای شخص. کد ملی ارجح است؛ اگر نبود کد پرسنلی.
   * پرونده‌ای که هیچ‌کدام را ندارد، شخص مستقل تلقی می‌شود (کلید null).
   */
  function keyOf(rec) {
    var nid = w.U.toLatinDigits(rec.nationalId || '').replace(/\D/g, '');
    if (nid) return 'n:' + nid;
    var pc = w.U.toLatinDigits(rec.personnelCode || '').replace(/\D/g, '');
    if (pc) return 'p:' + pc;
    return null;
  }

  function fullName(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ').trim();
  }

  /** ترتیب زمانی پرونده‌ها: تاریخ ورود، وگرنه شمارهٔ پرونده */
  function sortCases(list) {
    return list.slice().sort(function (a, b) {
      var da = a.intakeDate || '', db = b.intakeDate || '';
      if (da !== db) return da < db ? -1 : 1;
      return String(a.caseNo || '').localeCompare(String(b.caseNo || ''), 'fa');
    });
  }

  /**
   * ناسازگاری مشخصات هویتی بین پرونده‌های یک شخص.
   * با یک کد ملی نباید دو نام خانوادگی متفاوت ثبت شده باشد.
   */
  function conflicts(cases) {
    var out = [];
    IDENTITY_FIELDS.forEach(function (f) {
      var seen = {};
      cases.forEach(function (c) {
        var v = String(c[f.key] || '').trim();
        if (!v) return;
        (seen[v] = seen[v] || []).push(c);
      });
      var values = Object.keys(seen);
      if (values.length > 1) {
        out.push({
          field: f.key, label: f.label,
          values: values.map(function (v) {
            return {
              value: v,
              caseNos: seen[v].map(function (c) { return c.caseNo || '—'; })
            };
          })
        });
      }
    });
    return out;
  }

  /**
   * پرتکرارترین مقدار یک فیلد بین پرونده‌های شخص.
   * اگر در یک پرونده نام غلط تایپ شده باشد، نباید نام نمایشی شخص را عوض کند.
   * در تساوی، مقدار تازه‌تر برنده است (چون فهرست به ترتیب زمانی است).
   */
  function dominant(orderedCases, key) {
    var counts = {}, order = [];
    orderedCases.forEach(function (c) {
      var v = String(c[key] || '').trim();
      if (!v) return;
      if (counts[v] == null) { counts[v] = 0; order.push(v); }
      counts[v]++;
    });
    if (!order.length) return '';
    var best = order[0];
    order.forEach(function (v) { if (counts[v] >= counts[best]) best = v; });
    return best;
  }

  /** ساخت شیء شخص از روی پرونده‌هایش */
  function build(key, cases) {
    var ordered = sortCases(cases);
    var latest = ordered[ordered.length - 1];
    var names = [];
    ordered.forEach(function (c) {
      var n = fullName(c);
      if (n && names.indexOf(n) < 0) names.push(n);
    });
    var open = ordered.filter(function (c) { return !w.Report.isClosed(c); });
    var profile = {};
    PROFILE_FIELDS.forEach(function (f) {
      // آخرین مقدار ثبت‌شده، از تازه‌ترین پرونده به عقب
      for (var i = ordered.length - 1; i >= 0; i--) {
        if (ordered[i][f]) { profile[f] = ordered[i][f]; break; }
      }
    });
    var name = [dominant(ordered, 'firstName'), dominant(ordered, 'lastName')]
      .filter(Boolean).join(' ').trim();
    return {
      key: key,
      nationalId: dominant(ordered, 'nationalId'),
      personnelCode: dominant(ordered, 'personnelCode'),
      name: name || fullName(latest) || 'بدون نام',
      // همهٔ املاهای ثبت‌شدهٔ نام، تا جستجو با هر کدامشان جواب بدهد
      aliases: names,
      fatherName: dominant(ordered, 'fatherName'),
      idNumber: dominant(ordered, 'idNumber'),
      gender: dominant(ordered, 'gender'),
      profile: profile,
      cases: ordered,
      caseCount: ordered.length,
      openCount: open.length,
      closedCount: ordered.length - open.length,
      firstIntake: ordered[0].intakeDate || '',
      lastIntake: latest.intakeDate || '',
      conflicts: conflicts(ordered),
      searchText: w.U.normalize([
        name, names.join(' '),
        dominant(ordered, 'nationalId'), dominant(ordered, 'personnelCode'),
        ordered.map(function (c) { return c.caseNo; }).join(' '),
        profile.orgUnit || '', profile.servicePlace || ''
      ].join(' '))
    };
  }

  // نمایه با هر تغییر در پرونده‌ها از سوی مدل باطل می‌شود؛ حدس‌زدن تغییر از
  // روی داده قابل اتکا نیست (مثلاً اصلاح نام، طول رکورد را عوض نمی‌کند).
  var cache = null;

  function index() {
    var groups = {};
    var singles = [];
    M.state.cases.forEach(function (rec) {
      var k = keyOf(rec);
      if (!k) { singles.push(rec); return; }
      (groups[k] = groups[k] || []).push(rec);
    });
    var people = Object.keys(groups).map(function (k) {
      return build(k, groups[k]);
    });
    // پرونده‌های بدون شناسه، هر کدام یک شخص جداگانه
    singles.forEach(function (rec) {
      people.push(build('c:' + rec.id, [rec]));
    });
    people.sort(function (a, b) {
      if (b.caseCount !== a.caseCount) return b.caseCount - a.caseCount;
      return String(a.name).localeCompare(String(b.name), 'fa');
    });
    return people;
  }

  function all() {
    if (!cache) cache = index();
    return cache;
  }

  function invalidate() { cache = null; }

  function get(key) {
    var found = all().filter(function (p) { return p.key === key; });
    return found[0] || null;
  }

  function forCase(rec) {
    if (!rec) return null;
    var k = keyOf(rec);
    return get(k || ('c:' + rec.id));
  }

  /** پرونده‌های دیگر همین شخص */
  function otherCases(rec) {
    var p = forCase(rec);
    if (!p) return [];
    return p.cases.filter(function (c) { return c.id !== rec.id; });
  }

  /** تایم‌لاین یکپارچهٔ همهٔ پرونده‌های یک شخص */
  function timeline(person) {
    var items = [];
    person.cases.forEach(function (rec) {
      M.timelineFor(rec).forEach(function (it) {
        items.push({
          caseNo: rec.caseNo || '—', caseId: rec.id,
          type: it.type, date: it.date, label: it.label,
          entry: it.entry, doc: it.doc, sortKey: it.sortKey
        });
      });
    });
    items.sort(function (a, b) { return a.sortKey < b.sortKey ? -1 : 1; });
    return items;
  }

  /** فاصلهٔ روز بین پرونده‌های پیاپی یک شخص */
  function intervals(person) {
    var out = [];
    for (var i = 1; i < person.cases.length; i++) {
      var a = person.cases[i - 1].intakeDate, b = person.cases[i].intakeDate;
      if (!a || !b) continue;
      var d = J.diffDays(b, a);
      if (d != null && d >= 0) out.push(d);
    }
    return out;
  }

  /** آمار تکرار تخلف روی یک برش از پرونده‌ها */
  function repeatStats(cases) {
    var groups = {};
    cases.forEach(function (rec) {
      var k = keyOf(rec) || ('c:' + rec.id);
      (groups[k] = groups[k] || []).push(rec);
    });
    var buckets = [
      { label: 'یک پرونده', value: 0, min: 1, max: 1 },
      { label: 'دو پرونده', value: 0, min: 2, max: 2 },
      { label: 'سه پرونده', value: 0, min: 3, max: 3 },
      { label: 'چهار پرونده و بیشتر', value: 0, min: 4, max: Infinity }
    ];
    var repeaters = [];
    Object.keys(groups).forEach(function (k) {
      var n = groups[k].length;
      for (var i = 0; i < buckets.length; i++) {
        if (n >= buckets[i].min && n <= buckets[i].max) { buckets[i].value++; break; }
      }
      if (n > 1) {
        var p = build(k, groups[k]);
        repeaters.push(p);
      }
    });
    repeaters.sort(function (a, b) { return b.caseCount - a.caseCount; });
    return {
      people: Object.keys(groups).length,
      buckets: buckets,
      repeaters: repeaters,
      repeatCases: repeaters.reduce(function (a, p) { return a + p.caseCount; }, 0)
    };
  }

  w.Person = {
    IDENTITY_FIELDS: IDENTITY_FIELDS, PROFILE_FIELDS: PROFILE_FIELDS,
    dominant: dominant,
    keyOf: keyOf, fullName: fullName, all: all, get: get, forCase: forCase,
    otherCases: otherCases, timeline: timeline, intervals: intervals,
    conflicts: conflicts, repeatStats: repeatStats, invalidate: invalidate
  };
})(window);
