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
  function safeName(name, fallback) {
    var s = String(name == null ? '' : name)
      .replace(/[\\/:*?"<>|]/g, '-')       // ممنوع در ویندوز
      .replace(/[\x00-\x1F\x7F]/g, '')     // نویسه‌های کنترلی
      .replace(/\s+/g, ' ')
      .trim()
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
      var name = rec.docFolder || folderNameFor(rec);
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
    docs.forEach(function (d) {
      if (d.scope === 'person') {
        (byPerson[d.personKey] = byPerson[d.personKey] || []).push(d);
        return;
      }
      if (!d.caseId) return;
      (byCase[d.caseId] = byCase[d.caseId] || []).push(d);
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
      return [d.kind, d.title, d.letterNo, d.fileName].filter(Boolean).join(' ');
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
        title: meta.title || '',
        letterNo: meta.letterNo || '',
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
        letterNo: meta.letterNo || '', docDate: meta.docDate || J.today(),
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
  function addVersion(rec, oldDoc, file) {
    var meta = {
      kind: oldDoc.kind, title: oldDoc.title,
      letterNo: oldDoc.letterNo, docDate: oldDoc.docDate
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
    return caseFolder(M.get(doc.caseId), false);
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
  function scan(rec) {
    return caseFolder(rec, false).then(listDir).then(function (entries) {
      var known = {};
      forCase(rec.id).forEach(function (d) { known[d.fileName.toLowerCase()] = true; });
      return entries.filter(function (e) {
        return e.kind === 'file' && !known[e.name.toLowerCase()] &&
          e.name.charAt(0) !== '.';
      });
    }).catch(function () { return []; });
  }

  /** ثبت یک فایل موجود در پوشه، بدون جابه‌جا کردنش */
  function register(rec, entry, meta) {
    return entry.getFile().then(function (file) {
      var doc = {
        id: w.U.uid(), chain: w.U.uid(), caseId: rec.id, caseNo: rec.caseNo || '',
        folderName: rec.docFolder || folderNameFor(rec), fileName: entry.name,
        originalName: entry.name,
        kind: (meta && meta.kind) || 'سایر', title: (meta && meta.title) || '',
        letterNo: (meta && meta.letterNo) || '',
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

  function load() {
    return w.Store.getAll('docs').then(function (list) {
      docs = list || [];
      indexDocs();
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
    forPerson: forPerson, currentForPerson: currentForPerson,
    allForPerson: allForPerson, addPersonFile: addPersonFile,
    personFolderNameFor: personFolderNameFor,
    folderMismatch: folderMismatch, folderNameFor: folderNameFor,
    fileNameFor: fileNameFor, safeName: safeName, kinds: kinds, stats: stats,
    indexDocs: indexDocs, clearMemory: clearMemory
  };
})(window);
