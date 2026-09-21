/*
 * مستندات پرونده: فایل‌ها در یک پوشهٔ واقعی روی دیسک کاربر ذخیره می‌شوند،
 * هر پرونده در زیرپوشهٔ خودش. فقط فراداده در دیتابیس می‌ماند.
 * نیازمند File System Access API (کروم/اج).
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  /* نوع سندها به ترتیب همان گردش‌کار واقعی پرونده چیده شده‌اند، تا موقع
     بارگذاری، گزینهٔ درست همان‌جایی باشد که چشم دنبالش می‌گردد. */
  var KINDS_DEFAULT = [
    'نامهٔ وارده', 'نامهٔ صادره', 'گزارش بازرسی',
    'حکم کارگزینی', 'نامهٔ رفع نواقص',
    'استعلام حراست', 'پاسخ حراست',
    'دعوت‌نامهٔ جلسه', 'دفاعیهٔ کتبی', 'نامهٔ پیگیری دفاعیات',
    'مدارک تکمیلی', 'نامهٔ حضور در جلسهٔ دفاع',
    'صورت‌جلسهٔ کمیته', 'رأی کمیته', 'نامهٔ ابلاغ رأی',
    'بازگشت ابلاغ', 'نتیجهٔ ابلاغ',
    'مدارک هویتی', 'سایر'
  ];

  /**
   * انواعی که به «شخص» تعلق دارند نه به یک پروندهٔ خاص.
   * یک کارمند ممکن است چند پرونده داشته باشد؛ شناسنامه و حکم کارگزینی‌اش
   * نباید در هر پرونده دوباره بارگذاری شود.
   */
  var PERSON_KINDS = ['مدارک هویتی', 'حکم کارگزینی'];

  var PERSON_ROOT = '_مدارک اشخاص';
  /* سندی که هیچ پرونده‌ای ندارد — «اسکن متفرقه» و هرچه هنوز معلوم نیست
     مالِ کدام پرونده است. زیرپوشهٔ سال، و داخلش پوشهٔ همان دسته. */
  var ARCHIVE_ROOT = '_بایگانی';

  /*
   * دستهٔ سند از روی نوعش درمی‌آید، نه با پرسیدن دوباره از کاربر: کسی که
   * نوع را انتخاب کرده، دسته را هم انتخاب کرده. دسته‌ها کم و درشت‌اند تا
   * فهرست مستندات با چند بخش خوانا تمام شود، نه با بیست عنوان ریز.
   */
  var CATEGORIES = [
    { key: 'letters', label: 'مکاتبات' },
    { key: 'report', label: 'گزارش و مستندات تخلف' },
    { key: 'identity', label: 'مدارک هویتی و شغلی' },
    { key: 'defense', label: 'دفاعیات و استعلام' },
    { key: 'verdict', label: 'رأی و ابلاغ' },
    { key: 'other', label: 'سایر' }
  ];

  var KIND_CATEGORY = {
    'نامهٔ وارده': 'letters', 'نامهٔ صادره': 'letters',
    'نامهٔ رفع نواقص': 'letters', 'نامهٔ پیگیری دفاعیات': 'letters',
    'نامهٔ حضور در جلسهٔ دفاع': 'letters', 'دعوت‌نامهٔ جلسه': 'letters',
    'گزارش بازرسی': 'report', 'مدارک تکمیلی': 'report',
    'حکم کارگزینی': 'identity', 'مدارک هویتی': 'identity',
    'دفاعیهٔ کتبی': 'defense', 'استعلام حراست': 'defense', 'پاسخ حراست': 'defense',
    'صورت‌جلسهٔ کمیته': 'verdict', 'رأی کمیته': 'verdict',
    'نامهٔ ابلاغ رأی': 'verdict', 'بازگشت ابلاغ': 'verdict', 'نتیجهٔ ابلاغ': 'verdict'
  };

  /*
   * جهت نامه — وارده، صادره، یا هیچ‌کدام. این از «نوع سند» جداست: نوع
   * می‌گوید چه سندی است، جهت می‌گوید از بیرون آمده یا از اینجا رفته. برای
   * نوع‌هایی که جهتشان معلوم است حدس زده می‌شود و کاربر می‌تواند عوضش کند؛
   * برای مدرکی که اصلاً نامه نیست (شناسنامه، حکم) جهت خالی می‌ماند.
   */
  var DIRECTIONS = [
    { key: '', label: 'بدون جهت (مدرک)' },
    { key: 'in', label: 'وارده' },
    { key: 'out', label: 'صادره' }
  ];

  var KIND_DIRECTION = {
    'نامهٔ وارده': 'in', 'گزارش بازرسی': 'in', 'دفاعیهٔ کتبی': 'in',
    'پاسخ حراست': 'in', 'بازگشت ابلاغ': 'in', 'نتیجهٔ ابلاغ': 'in',
    'نامهٔ صادره': 'out', 'نامهٔ رفع نواقص': 'out', 'دعوت‌نامهٔ جلسه': 'out',
    'نامهٔ پیگیری دفاعیات': 'out', 'نامهٔ حضور در جلسهٔ دفاع': 'out',
    'استعلام حراست': 'out', 'نامهٔ ابلاغ رأی': 'out'
  };

  /*
   * نوع سند → فیلدهای پروندهٔ متناظرش.
   *
   * تا امروز فقط مسیر «دکمهٔ آلارم» تاریخ مرحله را پر می‌کرد؛ اگر همان سند
   * را از تب مستندات یا از گیرهٔ کنار فیلد بارگذاری می‌کردید، هیچ فیلدی پر
   * نمی‌شد. یعنی یک کار، سه رفتار. حالا این نقشه یک جاست و هر مسیری که
   * سند ثبت کند، همین فیلدها را پر می‌کند.
   *
   * قاعده: فقط فیلدِ **خالی** پر می‌شود. چیزی که کاربر خودش نوشته، هیچ‌وقت
   * با فرادادهٔ یک سند بازنویسی نمی‌شود.
   */
  var KIND_FIELDS = {
    'نامهٔ وارده': { date: 'letterDate', no: 'letterNo' },
    'گزارش بازرسی': { date: 'letterDate', no: 'letterNo' },
    'حکم کارگزینی': { date: 'decreeDate' },
    'نامهٔ رفع نواقص': { date: 'defectLetterDate', no: 'defectLetterNo' },
    'دعوت‌نامهٔ جلسه': { date: 'invitationLetterDate', no: 'invitationLetterNo' },
    'استعلام حراست': { date: 'securityOutLetterDate', no: 'securityOutLetterNo' },
    'پاسخ حراست': {
      date: 'securityInLetterDate', no: 'securityInLetterNo',
      body: 'securityAnswerSubject'
    },
    'دفاعیهٔ کتبی': { date: 'defenseReceivedDate', body: 'defenseSummary' },
    'نامهٔ پیگیری دفاعیات': { date: 'defenseChaseLetterDate' },
    'مدارک تکمیلی': { date: 'docsCompleteDate' },
    'نامهٔ حضور در جلسهٔ دفاع': {
      date: 'hearingLetterDate', no: 'hearingLetterNo'
    },
    'صورت‌جلسهٔ کمیته': { date: 'committeeDate' },
    'رأی کمیته': { date: 'verdictDate', no: 'committeeRegNo', body: 'verdictFull' },
    'نامهٔ ابلاغ رأی': { date: 'noticeLetterDate', no: 'noticeLetterNo' },
    'نتیجهٔ ابلاغ': { date: 'noticeResultDate' }
  };

  function fieldsForKind(kind) { return KIND_FIELDS[kind] || null; }

  function labelOfField(key) {
    var f = M.FIELD_BY_KEY[key];
    return f ? String(f.label).replace(/\s*\(\d+\)\s*$/, '').trim() : key;
  }

  /**
   * آنچه یک سند دربارهٔ پرونده می‌گوید، در خود پرونده هم ثبت می‌شود.
   * برمی‌گرداند: فهرست فیلدهایی که پر شدند (برای پیام به کاربر).
   */
  function applyToCase(rec, doc) {
    var map = fieldsForKind(doc && doc.kind);
    if (!rec || !map || doc.scope === 'person') return Promise.resolve([]);
    var fresh = M.get(rec.id) || rec;
    var patch = {}, filled = [];

    function take(key, value) {
      if (!key || !value) return;
      if (String(fresh[key] || '').trim()) return;     // دست‌نوشتهٔ کاربر مقدم است
      patch[key] = value;
      filled.push({ key: key, label: labelOfField(key), value: value });
    }

    take(map.date, doc.docDate);
    take(map.no, doc.letterNo);
    take(map.body, doc.body);

    if (!filled.length) return Promise.resolve([]);
    return M.applyPatches([{ id: fresh.id, patch: patch }], {
      kind: 'doc-sync',
      note: 'از روی سند «' + doc.kind + '»: ' +
        filled.map(function (f) { return f.label; }).join('، ') + ' پر شد'
    }).then(function () { return filled; });
  }

  /** سندهای جاریِ همین نوع در این پرونده — برای تشخیص تکراری */
  function sameKind(caseId, kind) {
    return current(caseId).filter(function (d) { return d.kind === kind; });
  }

  function categoryOf(kind) { return KIND_CATEGORY[kind] || 'other'; }
  function directionOf(kind) { return KIND_DIRECTION[kind] || ''; }

  function categoryLabel(key) {
    var found = CATEGORIES.filter(function (c) { return c.key === key; })[0];
    return found ? found.label : 'سایر';
  }

  function directionLabel(key) {
    var found = DIRECTIONS.filter(function (d) { return d.key === key; })[0];
    return found && key ? found.label : '';
  }

  /*
   * فیلدِ نامه → نوع سند.
   *
   * هر جا در فرم پرونده شمارهٔ نامه یا تاریخ نامه‌ای هست، پشتش یک کاغذ
   * واقعی وجود دارد. این نقشه می‌گوید آن کاغذ چه نوعی است، تا کنار همان
   * فیلد بشود متن نامه و تصویرش را پیوست کرد و همه در مستندات جمع شود —
   * بدون اینکه کاربر برود تب مستندات و دوباره نوعش را انتخاب کند.
   */
  var FIELD_KIND = {
    letterNo: 'نامهٔ وارده', letterDate: 'نامهٔ وارده',
    decreeDate: 'حکم کارگزینی',
    defectLetterNo: 'نامهٔ رفع نواقص', defectLetterDate: 'نامهٔ رفع نواقص',
    invitationLetterNo: 'دعوت‌نامهٔ جلسه', invitationLetterDate: 'دعوت‌نامهٔ جلسه',
    securityOutLetterNo: 'استعلام حراست', securityOutLetterDate: 'استعلام حراست',
    securityInLetterNo: 'پاسخ حراست', securityInLetterDate: 'پاسخ حراست',
    defenseReceivedDate: 'دفاعیهٔ کتبی', defenseSummary: 'دفاعیهٔ کتبی',
    defenseChaseLetterDate: 'نامهٔ پیگیری دفاعیات',
    docsCompleteDate: 'مدارک تکمیلی',
    hearingLetterNo: 'نامهٔ حضور در جلسهٔ دفاع',
    hearingLetterDate: 'نامهٔ حضور در جلسهٔ دفاع',
    committeeDate: 'صورت‌جلسهٔ کمیته',
    committeeRegNo: 'رأی کمیته', verdictDate: 'رأی کمیته',
    verdictFull: 'رأی کمیته', verdictSignedDate: 'رأی کمیته',
    noticeLetterNo: 'نامهٔ ابلاغ رأی', noticeLetterDate: 'نامهٔ ابلاغ رأی',
    noticeResultDate: 'نتیجهٔ ابلاغ', noticeReturn: 'نتیجهٔ ابلاغ',
    transferLetterNo: 'نامهٔ صادره'
  };

  function kindForField(key) { return FIELD_KIND[key] || ''; }

  /** اسناد جاریِ یک پرونده از یک نوع مشخص */
  function ofKind(caseId, kind) {
    return current(caseId).filter(function (d) { return d.kind === kind; });
  }

  /** نوع سند → مرحلهٔ گردش‌کار، برای نشاندن سند در تایم‌لاین */
  var KIND_STAGE = {
    'نامهٔ وارده': 'intake', 'گزارش بازرسی': 'intake',
    'دعوت‌نامهٔ جلسه': 'defense', 'دفاعیهٔ کتبی': 'defense',
    'استعلام حراست': 'defense', 'پاسخ حراست': 'defense',
    'صورت‌جلسهٔ کمیته': 'verdict', 'رأی کمیته': 'verdict',
    'نامهٔ ابلاغ رأی': 'notice', 'بازگشت ابلاغ': 'notice',
    'حکم کارگزینی': 'notice'
  };

  var docs = [];           // همهٔ رکوردهای فراداده
  var byCase = {};
  var byPerson = {};
  var generalDocs = [];    // سندهای بی‌پرونده
  var root = null;         // FileSystemDirectoryHandle پوشهٔ ریشه
  var rootName = '';
  var listeners = [];

  function emit() { listeners.forEach(function (fn) { fn(status()); }); }
  function onChange(fn) { listeners.push(fn); }

  function supported() { return typeof w.showDirectoryPicker === 'function'; }

  function hasStoredFolder() {
    var h = w.Store.metaGet('docsFolder', null);
    return !!(h && h.queryPermission);
  }

  function storedFolderName() {
    var h = w.Store.metaGet('docsFolder', null);
    return h ? h.name : '';
  }

  function status() {
    return {
      supported: supported(), linked: !!root, folderName: rootName,
      hasStored: hasStoredFolder(), storedName: storedFolderName()
    };
  }

  // -------------------------------------------------------- پاک‌سازی نام‌ها
  var WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

  /**
   * نامی که هم در ویندوز و هم در مک معتبر باشد.
   * حروف فارسی مشکلی ندارند؛ مسئله نویسه‌های ممنوع و نقطه/فاصلهٔ انتهایی است.
   */
  /*
   * نویسه‌های نامرئیِ قالب‌بندی (ردهٔ Cf یونیکد) — مهم‌ترینشان نیم‌فاصله
   * U+200C — در نام فایل مجاز نیستند: File System Access API کروم نامِ
   * حاوی آن‌ها را رد می‌کند و ساخت فایل با خطا می‌افتد. دو نوع سند
   * («دعوت‌نامهٔ جلسه» و «صورت‌جلسهٔ کمیته») و خیلی از نام‌های فارسی
   * («حق‌بین»، «علی‌رضا») نیم‌فاصله دارند، پس بارگذاری‌شان شکست می‌خورد.
   * نیم‌فاصله به فاصلهٔ معمولی تبدیل می‌شود — متن همان‌طور خوانده می‌شود —
   * و بقیهٔ نویسه‌های نامرئی حذف می‌شوند. این فقط روی نام فایل روی دیسک
   * اثر دارد؛ خودِ داده در برنامه دست‌نخورده می‌ماند.
   */
  var ZWNJ = /\u200C/g;
  var INVISIBLE = /[\u00AD\u200B\u200D-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

  function safeName(name, fallback) {
    var s = String(name == null ? '' : name)
      .replace(ZWNJ, ' ')                  // نیم‌فاصله → فاصله
      .replace(INVISIBLE, '')              // بقیهٔ نویسه‌های نامرئی
      .replace(/[\\/:*?"<>|]/g, '-')       // ممنوع در ویندوز
      .replace(/[\x00-\x1F\x7F]/g, '')     // نویسه‌های کنترلی
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[. ]+/, '')               // نقطه/فاصلهٔ ابتدایی هم دردسر است
      .replace(/[. ]+$/, '');              // ویندوز نقطه/فاصلهٔ انتهایی نمی‌پذیرد
    if (WIN_RESERVED.test(s)) s = '_' + s;
    if (s.length > 120) s = s.slice(0, 120).trim().replace(/[. ]+$/, '');
    // نامی که پس از پاک‌سازی فقط خط تیره و فاصله مانده، نام نیست
    if (!/[\w\u0600-\u06FF]/.test(s)) s = '';
    return s || (fallback || 'بدون نام');
  }

  /** نام پوشهٔ یک پرونده: «شماره پرونده - نام و نام خانوادگی» */
  function folderNameFor(rec) {
    var person = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    var caseNo = w.U.toLatinDigits(rec.caseNo || '').trim();
    return safeName([caseNo, person].filter(Boolean).join(' - '), caseNo || rec.id);
  }

  /** پوشهٔ مدارک مشترک یک شخص: «کد ملی - نام و نام خانوادگی» */
  function personFolderNameFor(person) {
    var id = w.U.toLatinDigits(person.nationalId || person.personnelCode || '')
      .replace(/\D/g, '');
    return safeName([id, person.name].filter(Boolean).join(' - '), person.key);
  }

  function splitExt(fileName) {
    var m = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(String(fileName || ''));
    return { base: m[1] || 'سند', ext: (m[2] || '').toLowerCase() };
  }

  /** نام فایل: «۱۴۰۴-۰۷-۲۰ - نوع سند - شماره نامه - عنوان.pdf» */
  function fileNameFor(meta, originalName, versionSuffix) {
    var ext = splitExt(originalName).ext || '';
    var datePart = '';
    var p = J.unpack(meta.docDate || '');
    if (p) datePart = p.jy + '-' + J.pad2(p.jm) + '-' + J.pad2(p.jd);
    var parts = [datePart, meta.kind, meta.letterNo, meta.title]
      .map(function (x) { return String(x || '').trim(); })
      .filter(Boolean);
    var base = safeName(parts.join(' - '), splitExt(originalName).base);
    if (versionSuffix) base += ' - نسخه ' + versionSuffix;
    return base + ext;
  }

  // ------------------------------------------------------ کار با پوشهٔ ریشه
  function verify(handle) {
    var opts = { mode: 'readwrite' };
    return handle.queryPermission(opts).then(function (state) {
      if (state === 'granted') return true;
      return handle.requestPermission(opts).then(function (s) { return s === 'granted'; });
    });
  }

  function linkFolder() {
    if (!supported()) {
      return Promise.reject(new Error('این مرورگر از ذخیرهٔ مستندات در پوشه پشتیبانی نمی‌کند'));
    }
    return w.showDirectoryPicker({ mode: 'readwrite', id: 'parvandeha-docs' })
      .then(function (handle) {
        root = handle;
        rootName = handle.name;
        return w.Store.metaSet('docsFolder', handle);
      })
      .then(function () { emit(); return true; });
  }

  function unlinkFolder() {
    root = null;
    rootName = '';
    return w.Store.metaSet('docsFolder', null).then(emit);
  }

  /** اتصال دوبارهٔ پوشهٔ نشست قبل (با تأیید کاربر) */
  function relinkFolder(interactive) {
    var handle = w.Store.metaGet('docsFolder', null);
    if (!handle || !handle.queryPermission) return Promise.resolve(false);
    var check = interactive
      ? verify(handle)
      : handle.queryPermission({ mode: 'readwrite' }).then(function (s) {
        return s === 'granted';
      });
    return check.then(function (ok) {
      if (!ok) return false;
      root = handle;
      rootName = handle.name;
      emit();
      return true;
    }).catch(function () { return false; });
  }

  function requireRoot() {
    if (root) return Promise.resolve(root);
    return relinkFolder(true).then(function (ok) {
      if (!ok) throw new Error('پوشهٔ مستندات در دسترس نیست؛ از تنظیمات دوباره وصلش کنید');
      return root;
    });
  }

  /** پوشهٔ یک پرونده؛ نام پوشه پس از ساخت روی خود پرونده ثبت می‌شود */
  function caseFolder(rec, create) {
    return requireRoot().then(function (r) {
      /* اگر نام پوشه از نسخه‌های قبلی نویسهٔ نامرئی داشته باشد، پاکش
         می‌کنیم؛ وگرنه کروم همان خطای قبلی را می‌دهد. */
      var name = rec.docFolder
        ? safeName(rec.docFolder, folderNameFor(rec))
        : folderNameFor(rec);
      return r.getDirectoryHandle(name, { create: !!create }).then(function (dir) {
        if (create && rec.docFolder !== name) {
          rec.docFolder = name;
          return w.Store.put('cases', [M.strip(rec)]).then(function () { return dir; });
        }
        return dir;
      });
    });
  }

  /** پیمایش محتوای یک پوشه بدون نیاز به for-await */
  function listDir(dir) {
    var it = dir.values();
    var out = [];
    function step() {
      return it.next().then(function (r) {
        if (r.done) return out;
        out.push(r.value);
        return step();
      });
    }
    return step();
  }

  /** اگر نام تکراری بود، «(۲)» اضافه می‌کند */
  function uniqueName(dir, name) {
    return listDir(dir).then(function (entries) {
      var taken = {};
      entries.forEach(function (e) { taken[e.name.toLowerCase()] = true; });
      if (!taken[name.toLowerCase()]) return name;
      var s = splitExt(name), i = 2;
      while (taken[(s.base + ' (' + i + ')' + s.ext).toLowerCase()] && i < 500) i++;
      return s.base + ' (' + i + ')' + s.ext;
    });
  }

  // ----------------------------------------------------------- عملیات سند
  function indexDocs() {
    byCase = {};
    byPerson = {};
    generalDocs = [];
    docs.forEach(function (d) {
      if (d.scope === 'person') {
        (byPerson[d.personKey] = byPerson[d.personKey] || []).push(d);
        return;
      }
      if (d.scope === 'general' || (!d.caseId && !d.personKey)) {
        d.scope = 'general';
        generalDocs.push(d);
        return;
      }
      if (!d.caseId) return;
      (byCase[d.caseId] = byCase[d.caseId] || []).push(d);
    });
    generalDocs.sort(function (a, b) {
      return (a.docDate || '') < (b.docDate || '') ? 1 : -1;
    });
    function byDate(a, b) { return (a.docDate || '') < (b.docDate || '') ? -1 : 1; }
    Object.keys(byPerson).forEach(function (k) { byPerson[k].sort(byDate); });
    Object.keys(byCase).forEach(function (k) {
      byCase[k].sort(byDate);
      refreshSearchText(k);
    });
  }

  /** متن مستندات به نمایهٔ جستجوی پرونده اضافه می‌شود */
  function refreshSearchText(caseId) {
    var rec = M.get(caseId);
    if (!rec) return;
    rec._docText = (byCase[caseId] || []).map(function (d) {
      // متن نامه هم جستجو می‌شود؛ همین است که «آن نامه‌ای که نوشته بود…»
      // را بدون باز کردن تک‌تک فایل‌ها پیدا می‌کند.
      return [d.kind, d.title, d.letterNo, d.body, d.fileName,
        (d.tags || []).join(' '), d.batchName].filter(Boolean).join(' ');
    }).join(' ');
    M.reindex(rec);
  }

  function forCase(caseId) { return byCase[caseId] || []; }

  function forPerson(personKey) { return byPerson[personKey] || []; }

  function currentForPerson(personKey) {
    return forPerson(personKey).filter(function (d) { return !d.superseded; });
  }

  /** همهٔ اسناد یک شخص: مدارک مشترک + اسناد همهٔ پرونده‌هایش */
  function allForPerson(person) {
    var out = currentForPerson(person.key).slice();
    person.cases.forEach(function (c) {
      out = out.concat(current(c.id));
    });
    return out;
  }

  function current(caseId) {
    return forCase(caseId).filter(function (d) { return !d.superseded; });
  }

  function versionsOf(doc) {
    return forCase(doc.caseId).filter(function (d) {
      return d.chain === doc.chain && d.id !== doc.id;
    }).sort(function (a, b) { return a.version - b.version; });
  }

  function persist(list) { return w.Store.put('docs', list); }

  /**
   * افزودن یک فایل به پروندهٔ مشخص.
   * meta: {kind, title, letterNo, docDate}
   */
  function addFile(rec, file, meta) {
    return caseFolder(rec, true).then(function (dir) {
      var wanted = fileNameFor(meta, file.name, null);
      return uniqueName(dir, wanted).then(function (name) {
        return dir.getFileHandle(name, { create: true }).then(function (fh) {
          return fh.createWritable().then(function (wr) {
            return wr.write(file).then(function () { return wr.close(); });
          }).then(function () { return name; });
        });
      });
    }).then(function (name) {
      var doc = {
        id: w.U.uid(),
        chain: w.U.uid(),
        caseId: rec.id,
        caseNo: rec.caseNo || '',
        folderName: rec.docFolder,
        fileName: name,
        originalName: file.name,
        kind: meta.kind || 'سایر',
        category: meta.category || categoryOf(meta.kind),
        direction: meta.direction == null ? directionOf(meta.kind) : meta.direction,
        title: meta.title || '',
        letterNo: meta.letterNo || '',
        body: meta.body || '',
        tags: cleanTags(meta.tags),
        batchId: meta.batchId || '',
        batchName: meta.batchName || '',
        docDate: meta.docDate || J.today(),
        stage: KIND_STAGE[meta.kind] || '',
        size: file.size,
        mime: file.type || '',
        version: 1,
        superseded: false,
        addedAt: new Date().toISOString(),
        addedAtJalali: J.stamp(),
        user: M.state.settings.user || 'کاربر'
      };
      docs.push(doc);
      indexDocs();
      return persist([doc]).then(function () {
        M.addHistory('doc-add', rec, [],
          doc.kind + (doc.title ? ' («' + doc.title + '»)' : '') +
          ' — فایل: ' + doc.fileName);
        return doc;
      });
    });
  }

  /* ================================================================
     سندِ بی‌پرونده و «دسته»
     ----------------------------------------------------------------
     دسته، ظرفِ سند نیست؛ یک نوبتِ کار است.
     
     اگر دسته ظرف بود، سندِ رأیِ پروندهٔ ۱۴۰۴۳۰۸ می‌رفت داخل «اسکن
     یکشنبه» و از پوشهٔ پروندهٔ خودش بیرون می‌ماند — و روزی که آن کار
     حذف شود، سند هم می‌رفت. پس هر سند همان‌جا که باید می‌نشیند، و دسته
     فقط برچسبی است که موقع بارگذاری روی همه‌شان می‌خورد. یک دسته
     می‌تواند هم‌زمان سندِ سه پرونده و پنج سندِ بی‌پرونده داشته باشد.
     
     فقط سندِ بی‌پرونده جای فیزیکیِ تازه لازم دارد؛ پوشه‌اش شکلِ همان
     دسته را روی دیسک نگه می‌دارد، چون آن پوشه چیزی است که در ویندوز
     هم بازش می‌کنید:
     
       _بایگانی/۱۴۰۵/۱۴۰۵-۰۶-۳۰ اسکن آرای صادره/
     ================================================================ */

  /** نام پوشهٔ یک دسته روی دیسک */
  function batchFolderName(meta) {
    var p = J.unpack(meta.docDate || J.today());
    var day = p ? (p.jy + '-' + J.pad2(p.jm) + '-' + J.pad2(p.jd)) : '';
    return safeName([day, meta.batchName || 'اسکن'].filter(Boolean).join(' '), day);
  }

  function archiveFolder(meta, create) {
    var p = J.unpack(meta.docDate || J.today());
    var year = p ? String(p.jy) : 'بدون سال';
    return requireRoot().then(function (r) {
      return r.getDirectoryHandle(ARCHIVE_ROOT, { create: !!create });
    }).then(function (dir) {
      return dir.getDirectoryHandle(year, { create: !!create });
    }).then(function (dir) {
      if (!meta.batchName) return dir;
      return dir.getDirectoryHandle(batchFolderName(meta), { create: !!create });
    });
  }

  /** مسیر خواناى پوشهٔ یک سند بی‌پرونده، برای نمایش و بازگشایی */
  function archivePathOf(meta) {
    var p = J.unpack(meta.docDate || J.today());
    var year = p ? String(p.jy) : 'بدون سال';
    return ARCHIVE_ROOT + '/' + year +
      (meta.batchName ? '/' + batchFolderName(meta) : '');
  }

  /**
   * افزودن سندِ بی‌پرونده.
   * meta: {kind, title, letterNo, docDate, tags, batchId, batchName, body}
   */
  function addGeneralFile(file, meta) {
    meta = meta || {};
    return archiveFolder(meta, true).then(function (dir) {
      var wanted = fileNameFor(meta, file.name, null);
      return uniqueName(dir, wanted).then(function (name) {
        return dir.getFileHandle(name, { create: true }).then(function (fh) {
          return fh.createWritable().then(function (wr) {
            return wr.write(file).then(function () { return wr.close(); });
          }).then(function () { return name; });
        });
      });
    }).then(function (name) {
      var doc = {
        id: w.U.uid(), chain: w.U.uid(),
        scope: 'general', caseId: '', caseNo: '',
        folderName: archivePathOf(meta),
        fileName: name, originalName: file.name,
        kind: meta.kind || 'سایر',
        category: meta.category || categoryOf(meta.kind || 'سایر'),
        direction: meta.direction == null
          ? directionOf(meta.kind || 'سایر') : meta.direction,
        title: meta.title || '', letterNo: meta.letterNo || '',
        body: meta.body || '',
        tags: cleanTags(meta.tags),
        batchId: meta.batchId || '', batchName: meta.batchName || '',
        docDate: meta.docDate || J.today(),
        stage: '', size: file.size, mime: file.type || '',
        version: 1, superseded: false,
        addedAt: new Date().toISOString(), addedAtJalali: J.stamp(),
        user: M.state.settings.user || 'کاربر'
      };
      docs.push(doc);
      indexDocs();
      return persist([doc]).then(function () { return doc; });
    });
  }

  function general() {
    return generalDocs.filter(function (d) { return !d.superseded; });
  }

  /** همهٔ سندهای دیدنی — مبنای شمارنده‌های بایگانی */
  function visibleDocs() { return docs.filter(visible); }

  /**
   * دسته‌ها، تازه‌ترین اول.
   * از روی خودِ سندها ساخته می‌شود، نه از یک انبار جدا: دسته چیزی جز
   * «سندهایی با همین شناسه» نیست، و انبار جدا یعنی امکانِ ناهمخوانی.
   */
  /** سندی که دیده می‌شود: نه بایگانی‌شدهٔ نسخهٔ قبلی، نه بیرون از دامنه */
  function visible(d) {
    if (d.superseded) return false;
    if (!d.caseId) return true;
    var rec = M.get(d.caseId);
    return !!rec && (!M.inScope || M.inScope(rec));
  }

  function batches() {
    var map = {};
    docs.forEach(function (d) {
      if (!d.batchId || !visible(d)) return;
      var b = map[d.batchId] || (map[d.batchId] = {
        id: d.batchId, name: d.batchName || 'بدون نام',
        at: d.addedAt, atJalali: d.addedAtJalali, date: d.docDate,
        user: d.user, docs: [], cases: {}, tags: {}, general: 0, size: 0
      });
      b.docs.push(d);
      b.size += d.size || 0;
      if (d.caseId) b.cases[d.caseId] = true; else b.general++;
      (d.tags || []).forEach(function (t) { b.tags[t] = true; });
      if (d.addedAt < b.at) { b.at = d.addedAt; b.atJalali = d.addedAtJalali; }
    });
    return Object.keys(map).map(function (k) {
      var b = map[k];
      b.caseCount = Object.keys(b.cases).length;
      b.tagList = Object.keys(b.tags);
      return b;
    }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }

  function batch(id) {
    return batches().filter(function (b) { return b.id === id; })[0] || null;
  }

  /**
   * وصل کردن یک سندِ بی‌پرونده به پرونده.
   *
   * فقط فراداده عوض نمی‌شود — خودِ فایل هم روی دیسک به پوشهٔ آن پرونده
   * منتقل می‌شود. اگر فایل در «_بایگانی» بماند و رکورد بگوید مالِ فلان
   * پرونده است، دو حقیقت داریم و یکی‌شان دروغ است.
   *
   * جابه‌جایی در این API «کپی و حذف» است: getFileHandle کپی ندارد.
   */
  function attachToCase(doc, rec) {
    if (!doc || doc.scope !== 'general') {
      return Promise.reject(new Error('این سند از قبل به پرونده‌ای وصل است'));
    }
    if (!rec) return Promise.reject(new Error('پرونده مشخص نیست'));
    var oldName = doc.fileName;
    return readFile(doc).then(function (file) {
      return caseFolder(rec, true).then(function (dir) {
        var wanted = fileNameFor(doc, doc.originalName || oldName, null);
        return uniqueName(dir, wanted).then(function (name) {
          return dir.getFileHandle(name, { create: true }).then(function (fh) {
            return fh.createWritable().then(function (wr) {
              return wr.write(file).then(function () { return wr.close(); });
            });
          }).then(function () { return name; });
        });
      });
    }).then(function (name) {
      // فایل در جای تازه نشست؛ حالا نسخهٔ قدیمی برود
      return archiveFolder(doc, false).then(function (dir) {
        return dir.removeEntry(oldName).catch(function () { /* نبود، مهم نیست */ });
      }).catch(function () { /* پوشه نبود */ }).then(function () { return name; });
    }).then(function (name) {
      doc.scope = 'case';
      doc.caseId = rec.id;
      doc.caseNo = rec.caseNo || '';
      doc.folderName = rec.docFolder;
      doc.fileName = name;
      doc.stage = KIND_STAGE[doc.kind] || '';
      doc.attachedAt = new Date().toISOString();
      indexDocs();
      return persist([doc]).then(function () {
        M.addHistory('doc-attach', rec, [],
          'سند بایگانی به این پرونده وصل شد: ' + doc.kind + ' — ' + doc.fileName);
        return applyToCase(rec, doc).then(function () { return doc; });
      });
    });
  }

  /**
   * جستجوی سندمحور — خروجی سند است نه پرونده.
   * opts: { tags:[], kind, batchId, scope }
   */
  function searchDocs(q, opts) {
    opts = opts || {};
    var tokens = w.U.normalize(q || '').split(' ').filter(Boolean);
    return docs.filter(function (d) {
      if (d.superseded) return false;
      /* سندِ پرونده‌ای که بیرون دامنهٔ کار است، در جستجوی بایگانی هم
         نمی‌آید — وگرنه یک صفحه چیزی می‌شمرد که صفحهٔ دیگر نمی‌شمرد. */
      if (d.caseId) {
        var owner = M.get(d.caseId);
        if (!owner || (M.inScope && !M.inScope(owner))) return false;
      }
      if (opts.scope && (d.scope || 'case') !== opts.scope) return false;
      if (opts.kind && d.kind !== opts.kind) return false;
      if (opts.batchId && d.batchId !== opts.batchId) return false;
      if (opts.tags && opts.tags.length) {
        var has = d.tags || [];
        for (var i = 0; i < opts.tags.length; i++) {
          if (has.indexOf(opts.tags[i]) < 0) return false;
        }
      }
      if (!tokens.length) return true;
      var rec = d.caseId ? M.get(d.caseId) : null;
      var blob = w.U.normalize([
        d.kind, d.title, d.letterNo, d.body, d.fileName, d.originalName,
        d.batchName, (d.tags || []).join(' '),
        rec ? rec.caseNo : '', rec ? (rec.firstName + ' ' + rec.lastName) : ''
      ].filter(Boolean).join(' '));
      for (var k = 0; k < tokens.length; k++) {
        if (blob.indexOf(tokens[k]) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (a.addedAt || '') < (b.addedAt || '') ? 1 : -1;
    });
  }

  /** پوشهٔ مدارک مشترک یک شخص، زیر پوشهٔ ریشه */
  function personFolder(person, create) {
    return requireRoot().then(function (r) {
      return r.getDirectoryHandle(PERSON_ROOT, { create: !!create });
    }).then(function (dir) {
      return dir.getDirectoryHandle(personFolderNameFor(person), { create: !!create });
    });
  }

  /**
   * افزودن مدرک در سطح شخص. رویداد در تاریخچهٔ پرونده‌ای ثبت می‌شود که
   * کاربر از آن اقدام کرده، ولی مدرک به همهٔ پرونده‌های آن شخص تعلق دارد.
   */
  function addPersonFile(person, file, meta, fromCase) {
    return personFolder(person, true).then(function (dir) {
      var wanted = fileNameFor(meta, file.name, null);
      return uniqueName(dir, wanted).then(function (name) {
        return dir.getFileHandle(name, { create: true }).then(function (fh) {
          return fh.createWritable().then(function (wr) {
            return wr.write(file).then(function () { return wr.close(); });
          }).then(function () { return name; });
        });
      });
    }).then(function (name) {
      var doc = {
        id: w.U.uid(), chain: w.U.uid(),
        scope: 'person', personKey: person.key,
        personName: person.name,
        folderName: PERSON_ROOT + '/' + personFolderNameFor(person),
        fileName: name, originalName: file.name,
        kind: meta.kind || 'مدارک هویتی', title: meta.title || '',
        category: meta.category || categoryOf(meta.kind || 'مدارک هویتی'),
        direction: meta.direction == null
          ? directionOf(meta.kind || 'مدارک هویتی') : meta.direction,
        letterNo: meta.letterNo || '', body: meta.body || '',
        docDate: meta.docDate || J.today(),
        stage: '', size: file.size, mime: file.type || '',
        version: 1, superseded: false,
        addedAt: new Date().toISOString(), addedAtJalali: J.stamp(),
        user: M.state.settings.user || 'کاربر'
      };
      docs.push(doc);
      indexDocs();
      return persist([doc]).then(function () {
        if (fromCase) {
          M.addHistory('doc-person', fromCase, [], doc.kind +
            ' — مدرک شخص (مشترک بین همهٔ پرونده‌های این فرد): ' + doc.fileName);
        }
        return doc;
      });
    });
  }

  /** نسخهٔ تازه از یک سند؛ نسخهٔ قبلی روی دیسک دست‌نخورده می‌ماند */
  /**
   * نسخهٔ تازه از یک سند.
   * over: فرادادهٔ تازه، اگر کاربر داده باشد؛ وگرنه همان قبلی می‌ماند.
   */
  function addVersion(rec, oldDoc, file, over) {
    over = over || {};
    var meta = {
      kind: over.kind || oldDoc.kind,
      title: over.title || oldDoc.title,
      letterNo: over.letterNo || oldDoc.letterNo,
      body: over.body || oldDoc.body,
      docDate: over.docDate || oldDoc.docDate
    };
    var nextVersion = Math.max.apply(null, forCase(rec.id)
      .filter(function (d) { return d.chain === oldDoc.chain; })
      .map(function (d) { return d.version; })) + 1;

    return caseFolder(rec, true).then(function (dir) {
      var wanted = fileNameFor(meta, file.name, nextVersion);
      return uniqueName(dir, wanted).then(function (name) {
        return dir.getFileHandle(name, { create: true }).then(function (fh) {
          return fh.createWritable().then(function (wr) {
            return wr.write(file).then(function () { return wr.close(); });
          }).then(function () { return name; });
        });
      });
    }).then(function (name) {
      oldDoc.superseded = true;
      var doc = {
        id: w.U.uid(), chain: oldDoc.chain, caseId: rec.id, caseNo: rec.caseNo || '',
        folderName: rec.docFolder, fileName: name, originalName: file.name,
        kind: meta.kind, title: meta.title, letterNo: meta.letterNo,
        category: oldDoc.category || categoryOf(meta.kind),
        direction: oldDoc.direction == null ? directionOf(meta.kind) : oldDoc.direction,
        body: meta.body == null ? (oldDoc.body || '') : meta.body,
        docDate: meta.docDate, stage: oldDoc.stage,
        size: file.size, mime: file.type || '', version: nextVersion,
        superseded: false, addedAt: new Date().toISOString(),
        addedAtJalali: J.stamp(), user: M.state.settings.user || 'کاربر'
      };
      docs.push(doc);
      indexDocs();
      return persist([oldDoc, doc]).then(function () {
        M.addHistory('doc-version', rec, [], doc.kind + ' — نسخهٔ ' +
          w.U.toFaDigits(nextVersion) + ' ثبت شد؛ نسخهٔ قبلی نگه داشته شد.');
        return doc;
      });
    });
  }

  /** پوشهٔ نگهدارندهٔ یک سند، چه در سطح پرونده چه در سطح شخص */
  function folderOf(doc) {
    if (doc.scope === 'person') {
      var person = w.Person.get(doc.personKey);
      if (!person) return Promise.reject(new Error('شخص این سند پیدا نشد'));
      return personFolder(person, false);
    }
    if (doc.scope === 'general') return archiveFolder(doc, false);
    var rec = M.get(doc.caseId);
    if (!rec) return Promise.reject(new Error('پروندهٔ این سند پیدا نشد'));
    return caseFolder(rec, false);
  }

  /** فایل یک سند را از پوشه می‌خواند (برای پیش‌نمایش یا باز کردن) */
  function readFile(doc) {
    return folderOf(doc)
      .then(function (dir) { return dir.getFileHandle(doc.fileName); })
      .then(function (fh) { return fh.getFile(); });
  }

  function openDoc(doc) {
    return folderOf(doc)
      .then(function (dir) { return dir.getFileHandle(doc.fileName); })
      .then(function (fh) { return fh.getFile(); })
      .then(function (file) {
        // بدون نوع MIME درست، مرورگر PDF را به‌جای نمایش، متن خام نشان می‌دهد
        var blob = (doc.mime && file.type !== doc.mime)
          ? new Blob([file], { type: doc.mime })
          : file;
        var url = URL.createObjectURL(blob);
        var win = w.open(url, '_blank');
        if (!win) w.U.download(doc.fileName, blob);
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        return true;
      })
      .catch(function (err) {
        doc.missing = true;
        persist([doc]);
        throw new Error('فایل در پوشه پیدا نشد: ' + doc.fileName);
      });
  }

  function removeDoc(doc) {
    var rec = doc.caseId ? M.get(doc.caseId) : null;
    return folderOf(doc).then(function (dir) {
      return dir.removeEntry(doc.fileName).catch(function () { /* از قبل نبوده */ });
    }).catch(function () { /* پوشه در دسترس نیست */ })
      .then(function () {
        docs = docs.filter(function (d) { return d.id !== doc.id; });
        // اگر نسخهٔ جاری حذف شد، آخرین نسخهٔ قبلی دوباره جاری می‌شود
        var chain = docs.filter(function (d) { return d.chain === doc.chain; });
        var touched = [];
        if (chain.length) {
          chain.sort(function (a, b) { return a.version - b.version; });
          var last = chain[chain.length - 1];
          if (last.superseded) { last.superseded = false; touched.push(last); }
        }
        indexDocs();
        return w.Store.remove('docs', [doc.id]).then(function () {
          return touched.length ? persist(touched) : null;
        }).then(function () {
          if (rec) {
                M.addHistory('doc-remove', rec, [], doc.kind + ' — فایل: ' + doc.fileName);
          }
        });
      });
  }

  /** فایل‌هایی که در پوشه هستند ولی در برنامه ثبت نشده‌اند (مثلاً خروجی اسکنر) */
  /**
   * فایل‌های ثبت‌نشدهٔ داخل زیرپوشهٔ این پرونده.
   *
   * قبلاً هر خطایی را می‌بلعید و آرایهٔ خالی برمی‌گرداند؛ نتیجه‌اش این بود
   * که «پوشه هنوز ساخته نشده»، «اجازه از بین رفته» و «فایل تازه‌ای نبود»
   * هر سه یک پیام می‌دادند و کاربر فکر می‌کرد دکمه کار نمی‌کند. حالا علت
   * را هم برمی‌گرداند تا پیام درست گفته شود.
   *
   * خروجی: { entries, reason, folder }
   *   reason: '' (سالم) | 'no-root' | 'no-folder' | 'error'
   */
  function scan(rec) {
    var folder = rec.docFolder || folderNameFor(rec);
    if (!root) {
      return Promise.resolve({ entries: [], reason: 'no-root', folder: folder });
    }
    return caseFolder(rec, false).then(listDir).then(function (entries) {
      var known = {};
      forCase(rec.id).forEach(function (d) { known[d.fileName.toLowerCase()] = true; });
      return {
        entries: entries.filter(function (e) {
          return e.kind === 'file' && !known[e.name.toLowerCase()] &&
            e.name.charAt(0) !== '.';
        }),
        reason: '', folder: folder
      };
    }).catch(function (err) {
      return {
        entries: [],
        reason: (err && err.name === 'NotFoundError') ? 'no-folder' : 'error',
        message: err && err.message, folder: folder
      };
    });
  }

  /** ثبت یک فایل موجود در پوشه، بدون جابه‌جا کردنش */
  function register(rec, entry, meta) {
    return entry.getFile().then(function (file) {
      var doc = {
        id: w.U.uid(), chain: w.U.uid(), caseId: rec.id, caseNo: rec.caseNo || '',
        folderName: rec.docFolder || folderNameFor(rec), fileName: entry.name,
        originalName: entry.name,
        kind: (meta && meta.kind) || 'سایر', title: (meta && meta.title) || '',
        category: (meta && meta.category) || categoryOf(meta && meta.kind),
        direction: (meta && meta.direction != null)
          ? meta.direction : directionOf(meta && meta.kind),
        letterNo: (meta && meta.letterNo) || '', body: (meta && meta.body) || '',
        docDate: (meta && meta.docDate) || J.today(),
        stage: KIND_STAGE[(meta && meta.kind)] || '',
        size: file.size, mime: file.type || '', version: 1, superseded: false,
        addedAt: new Date().toISOString(), addedAtJalali: J.stamp(),
        user: M.state.settings.user || 'کاربر'
      };
      docs.push(doc);
      indexDocs();
      return persist([doc]).then(function () {
        M.addHistory('doc-add', rec, [], doc.kind + ' — فایل موجود در پوشه ثبت شد: ' +
          entry.name);
        return doc;
      });
    });
  }

  /**
   * هم‌نام کردن پوشه با مشخصات فعلی پرونده (کپی سپس حذف پوشهٔ قدیم).
   * پوشهٔ قدیم فقط پس از کپی موفق همهٔ فایل‌ها حذف می‌شود.
   */
  function renameFolder(rec) {
    var oldName = rec.docFolder;
    var newName = folderNameFor(rec);
    if (!oldName || oldName === newName) return Promise.resolve(false);
    return requireRoot().then(function (r) {
      return r.getDirectoryHandle(oldName).then(function (oldDir) {
        return r.getDirectoryHandle(newName, { create: true }).then(function (newDir) {
          return listDir(oldDir).then(function (entries) {
            var files = entries.filter(function (e) { return e.kind === 'file'; });
            return files.reduce(function (chain, entry) {
              return chain.then(function () {
                return entry.getFile().then(function (file) {
                  return newDir.getFileHandle(entry.name, { create: true })
                    .then(function (fh) { return fh.createWritable(); })
                    .then(function (wr) {
                      return wr.write(file).then(function () { return wr.close(); });
                    });
                });
              });
            }, Promise.resolve());
          }).then(function () {
            return r.removeEntry(oldName, { recursive: true });
          });
        });
      });
    }).then(function () {
      rec.docFolder = newName;
      var touched = forCase(rec.id);
      touched.forEach(function (d) { d.folderName = newName; });
      return Promise.all([
        w.Store.put('cases', [M.strip(rec)]),
        touched.length ? persist(touched) : null
      ]);
    }).then(function () {
      M.addHistory('doc-folder', rec, [], 'نام پوشهٔ مستندات به «' + newName + '» تغییر کرد');
      return true;
    });
  }

  function folderMismatch(rec) {
    return !!(rec.docFolder && rec.docFolder !== folderNameFor(rec));
  }

  function kinds() {
    return M.state.lists.DocKinds || KINDS_DEFAULT;
  }

  /* ================================================================
     تگ
     ----------------------------------------------------------------
     برچسب آزادِ محض بعد از سه ماه می‌شود «آرا»، «آراء» و «آرای صادره»،
     و جستجو بی‌معنا می‌شود. پس تگ‌ها یک فهرست‌اند که رشد می‌کند: هرچه
     تا امروز به کار رفته پیشنهاد می‌شود، و تگ تازه همان‌جا اضافه
     می‌شود — در همان فهرستی که تنظیمات هم ویرایشش می‌کند.
     ================================================================ */
  var TAGS_DEFAULT = ['آرا', 'ابلاغ', 'دفاعیه', 'استعلام', 'اسکن انبوه', 'متفرقه'];

  function tagList() {
    return (M.state.lists || {}).DocTags || TAGS_DEFAULT;
  }

  /** تگ‌هایی که واقعاً روی سندی نشسته‌اند، پرتکرارترین اول */
  function tagsInUse() {
    var count = {};
    docs.forEach(function (d) {
      (d.tags || []).forEach(function (t) { count[t] = (count[t] || 0) + 1; });
    });
    return Object.keys(count).sort(function (a, b) {
      return count[b] - count[a] || (a < b ? -1 : 1);
    });
  }

  /** پیشنهادها: آنچه به کار رفته، بعد آنچه در فهرست هست */
  function tagSuggestions() {
    var seen = {}, out = [];
    tagsInUse().concat(tagList()).forEach(function (t) {
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push(t);
    });
    return out;
  }

  function addTag(name) {
    var v = cleanTag(name);
    if (!v) return Promise.reject(new Error('نام تگ خالی است'));
    var lists = M.state.lists || {};
    var cur = (lists.DocTags || TAGS_DEFAULT).slice();
    if (cur.indexOf(v) >= 0) return Promise.resolve(v);
    cur.push(v);
    var next = {};
    Object.keys(lists).forEach(function (k) { next[k] = lists[k]; });
    next.DocTags = cur;
    return M.saveLists(next).then(function () { return v; });
  }

  /* تگ نباید فاصلهٔ اضافه، ویرگول یا نیم‌فاصلهٔ سرگردان داشته باشد،
     وگرنه «آرا » و «آرا» دو تگ می‌شوند. */
  function cleanTag(t) {
    return String(t == null ? '' : t)
      .replace(/[،,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanTags(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (t) {
      var v = cleanTag(t);
      if (!v || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    });
    return out;
  }

  /** تگ‌های یک سند را عوض می‌کند */
  function setTags(doc, list) {
    doc.tags = cleanTags(list);
    indexDocs();
    return persist([doc]).then(function () { return doc; });
  }

  // ------------------------------------------------------ پشتیبان خودکار
  /*
   * رمزنگاری، محرمانگی را نگه می‌دارد نه موجودیت را: هر کسی که به فایل
   * دسترسی دارد می‌تواند پاکش کند. جواب این، پشتیبان است نه صفحهٔ ورود.
   *
   * پس روزی یک بار — همان‌جا که پوشهٔ مستندات وصل است — یک نسخه در
   * زیرپوشهٔ «_پشتیبان» نوشته می‌شود. اگر رمز فعال باشد، پشتیبان هم
   * رمزشده است. آخرین KEEP نسخه می‌ماند و قدیمی‌ترها پاک می‌شوند تا
   * پوشه بی‌نهایت بزرگ نشود.
   */
  var BACKUP_ROOT = '_پشتیبان';
  var BACKUP_KEEP = 14;

  function backupName(now) {
    var p = J.unpack(J.today());
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var day = p ? (p.jy + '-' + J.pad2(p.jm) + '-' + J.pad2(p.jd))
      : now.toISOString().slice(0, 10);
    return 'parvandeha-' + day + '-' + hh + mm + '.json';
  }

  function backupFolder(create) {
    return requireRoot().then(function (r) {
      return r.getDirectoryHandle(BACKUP_ROOT, { create: !!create });
    });
  }

  /** فهرست پشتیبان‌های موجود، تازه‌ترین اول */
  function backups() {
    return backupFolder(false).then(listDir).then(function (entries) {
      return entries
        .filter(function (e) { return e.kind === 'file' && /\.json$/.test(e.name); })
        .map(function (e) { return e.name; })
        .sort()
        .reverse();
    }).catch(function () { return []; });
  }

  /**
   * یک پشتیبان می‌گیرد.
   * force=false یعنی «اگر امروز گرفته‌ای، دوباره نگیر».
   */
  function backupNow(force) {
    if (!root) return Promise.resolve(null);
    var now = new Date();
    var name = backupName(now);
    var today = name.slice(0, name.lastIndexOf('-'));
    return backups().then(function (existing) {
      if (!force && existing.some(function (n) { return n.indexOf(today) === 0; })) {
        return null;                       // امروز گرفته شده
      }
      return w.Vault.sealSnapshot(w.Store.snapshot()).then(function (payload) {
        return backupFolder(true).then(function (dir) {
          return dir.getFileHandle(name, { create: true })
            .then(function (fh) { return fh.createWritable(); })
            .then(function (wr) {
              return wr.write(new Blob([JSON.stringify(payload)],
                { type: 'application/json' })).then(function () { return wr.close(); });
            })
            .then(function () { return trimBackups(dir); })
            .then(function () {
              w.Store.metaSet('lastBackupAt', now.toISOString());
              return name;
            });
        });
      });
    }).catch(function (err) {
      console.warn('پشتیبان خودکار گرفته نشد:', err && err.message);
      return null;
    });
  }

  function trimBackups(dir) {
    return listDir(dir).then(function (entries) {
      var files = entries
        .filter(function (e) { return e.kind === 'file' && /\.json$/.test(e.name); })
        .map(function (e) { return e.name; })
        .sort();
      var extra = files.slice(0, Math.max(0, files.length - BACKUP_KEEP));
      return extra.reduce(function (chain, n) {
        return chain.then(function () {
          return dir.removeEntry(n).catch(function () { /* مهم نیست */ });
        });
      }, Promise.resolve());
    });
  }

  function backupStatus() {
    return {
      folder: BACKUP_ROOT,
      keep: BACKUP_KEEP,
      lastAt: w.Store.metaGet('lastBackupAt', '')
    };
  }

  /**
   * ویرایش فرادادهٔ یک سند — بدون دست زدن به خود فایل.
   * نوع، دسته، جهت، تاریخ، شمارهٔ نامه، عنوان و متن نامه اینجا عوض می‌شوند.
   */
  function updateMeta(doc, patch) {
    var before = { kind: doc.kind, direction: doc.direction, letterNo: doc.letterNo };
    ['kind', 'category', 'direction', 'title', 'letterNo', 'body', 'docDate']
      .forEach(function (k) {
        if (patch[k] !== undefined) doc[k] = patch[k];
      });
    if (patch.kind !== undefined) {
      doc.stage = KIND_STAGE[doc.kind] || '';
      // دسته و جهت پیروِ نوع‌اند؛ اگر کاربر خودش نگفته، با نوع تازه به‌روز شوند
      if (patch.category === undefined) doc.category = categoryOf(doc.kind);
      if (patch.direction === undefined) doc.direction = directionOf(doc.kind);
    }
    indexDocs();
    return persist([doc]).then(function () {
      var rec = doc.caseId ? M.get(doc.caseId) : null;
      if (rec && (before.kind !== doc.kind || before.letterNo !== doc.letterNo ||
        before.direction !== doc.direction)) {
        M.addHistory('doc-edit', rec, [], 'ویرایش مشخصات سند «' + doc.fileName +
          '» — نوع: ' + doc.kind + (directionLabel(doc.direction)
            ? '، ' + directionLabel(doc.direction) : ''));
      }
      return doc;
    });
  }

  /**
   * بستهٔ زیپ از چند سند.
   *
   * فایل‌ها با نام فارسی خودشان داخل زیپ می‌نشینند (نویسندهٔ ZIP پرچم UTF-8
   * می‌زند) و کنارشان یک «فهرست.txt» می‌آید تا بدون باز کردن تک‌تک فایل‌ها
   * معلوم باشد هر کدام چیست. اسنادی که فایلشان پیدا نشود، در فهرست با
   * نشانهٔ «یافت نشد» می‌آیند و بقیهٔ بسته سالم ساخته می‌شود.
   */
  function bundle(list, title) {
    var files = [], missing = [], used = {};
    var enc = new TextEncoder();

    return list.reduce(function (chain, doc) {
      return chain.then(function () {
        return readFile(doc).then(function (file) {
          return file.arrayBuffer().then(function (buf) {
            var name = doc.fileName;
            // دو سند هم‌نام (یکی از پرونده، یکی از مدارک شخص) روی هم نیفتند
            while (used[name]) {
              var parts = splitExt(name);
              name = parts.base + '-۲' + parts.ext;
            }
            used[name] = true;
            files.push({ name: name, data: new Uint8Array(buf) });
          });
        }).catch(function () { missing.push(doc); });
      });
    }, Promise.resolve()).then(function () {
      var lines = ['فهرست مدارک — ' + (title || '') , J.stamp(), ''];
      list.forEach(function (d, i) {
        lines.push(w.U.toFaDigits(i + 1) + ') ' + d.kind +
          (directionLabel(d.direction) ? ' (' + directionLabel(d.direction) + ')' : '') +
          (d.letterNo ? ' — شمارهٔ ' + d.letterNo : '') +
          (d.docDate ? ' — ' + J.format(d.docDate) : '') +
          (d.title ? ' — ' + d.title : '') +
          '\n     فایل: ' + d.fileName +
          (missing.indexOf(d) >= 0 ? '   ← یافت نشد' : ''));
      });
      files.push({ name: 'فهرست.txt', data: enc.encode(lines.join('\n') + '\n') });
      return {
        blob: w.XLSX.zip(files, 'application/zip'),
        count: files.length - 1,
        missing: missing.length
      };
    });
  }

  function load() {
    return w.Store.getAll('docs').then(function (list) {
      docs = list || [];
      indexDocs();
      if (!M.state.lists.DocTags) M.state.lists.DocTags = TAGS_DEFAULT.slice();
      if (!M.state.lists.DocKinds) {
        M.state.lists.DocKinds = KINDS_DEFAULT.slice();
      } else {
        // نسخه‌های قبلی فهرست کوتاه‌تری داشتند؛ نوع‌های تازه اضافه می‌شوند
        KINDS_DEFAULT.forEach(function (k) {
          if (M.state.lists.DocKinds.indexOf(k) < 0) M.state.lists.DocKinds.push(k);
        });
      }
      return relinkFolder(false);
    });
  }

  function all() { return docs; }

  /** پاک کردن فرادادهٔ مستندات از حافظه، هنگام قفل شدن برنامه */
  function clearMemory() {
    docs = [];
    generalDocs = [];
    byCase = {};
    byPerson = {};
    root = null;
    rootName = '';
  }

  function stats() {
    var byKind = {};
    docs.forEach(function (d) {
      if (d.superseded) return;
      byKind[d.kind] = (byKind[d.kind] || 0) + 1;
    });
    return {
      total: docs.filter(function (d) { return !d.superseded; }).length,
      byKind: byKind,
      casesWithDocs: Object.keys(byCase).length
    };
  }

  w.Docs = {
    KINDS_DEFAULT: KINDS_DEFAULT, KIND_STAGE: KIND_STAGE,
    supported: supported, status: status, onChange: onChange,
    linkFolder: linkFolder, unlinkFolder: unlinkFolder, relinkFolder: relinkFolder,
    load: load, all: all, forCase: forCase, current: current, versionsOf: versionsOf,
    addFile: addFile, addVersion: addVersion, openDoc: openDoc, removeDoc: removeDoc,
    readFile: readFile,
    scan: scan, register: register, renameFolder: renameFolder,
    hasStoredFolder: hasStoredFolder, storedFolderName: storedFolderName,
    PERSON_KINDS: PERSON_KINDS, PERSON_ROOT: PERSON_ROOT,
    ARCHIVE_ROOT: ARCHIVE_ROOT,
    addGeneralFile: addGeneralFile, general: general, attachToCase: attachToCase,
    batches: batches, batch: batch, searchDocs: searchDocs,
    tagList: tagList, tagsInUse: tagsInUse, tagSuggestions: tagSuggestions,
    addTag: addTag, setTags: setTags, cleanTags: cleanTags,
    archivePathOf: archivePathOf, visibleDocs: visibleDocs,
    forPerson: forPerson, currentForPerson: currentForPerson,
    allForPerson: allForPerson, addPersonFile: addPersonFile,
    personFolderNameFor: personFolderNameFor,
    folderMismatch: folderMismatch, folderNameFor: folderNameFor,
    fileNameFor: fileNameFor, safeName: safeName, kinds: kinds, stats: stats,
    indexDocs: indexDocs, clearMemory: clearMemory,
    CATEGORIES: CATEGORIES, DIRECTIONS: DIRECTIONS,
    FIELD_KIND: FIELD_KIND, kindForField: kindForField, ofKind: ofKind,
    KIND_FIELDS: KIND_FIELDS, fieldsForKind: fieldsForKind,
    applyToCase: applyToCase, sameKind: sameKind,
    categoryOf: categoryOf, categoryLabel: categoryLabel,
    directionOf: directionOf, directionLabel: directionLabel,
    updateMeta: updateMeta, bundle: bundle,
    backupNow: backupNow, backups: backups, backupStatus: backupStatus,
    BACKUP_ROOT: BACKUP_ROOT, BACKUP_KEEP: BACKUP_KEEP
  };
})(window);
