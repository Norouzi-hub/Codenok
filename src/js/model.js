/* مدل داده: پرونده‌ها، تاریخچهٔ تغییرات، جستجو و فیلتر */
(function (w) {
  'use strict';

  var FIELDS = w.FIELDS;
  var FIELD_BY_KEY = {};
  FIELDS.forEach(function (f) { FIELD_BY_KEY[f.key] = f; });

  var DATE_KEYS = FIELDS.filter(function (f) { return f.type === 'date'; })
    .map(function (f) { return f.key; });

  var state = {
    cases: [],
    history: [],
    lists: {},
    columns: [],
    settings: { user: '', autoBackupEvery: 25, changesSinceBackup: 0 }
  };

  var byId = {};
  var historyByCase = {};

  // ------------------------------------------------------------- نمایهٔ جستجو
  function buildBlob(rec) {
    var parts = [];
    FIELDS.forEach(function (f) {
      var v = rec[f.key];
      if (!v) return;
      parts.push(v);
      if (f.type === 'date') parts.push(w.J.format(v, { latin: true }));
    });
    // نام و نوع مستندات پیوست هم باید با جستجوی سراسری پیدا شوند
    if (rec._docText) parts.push(rec._docText);
    return w.U.normalize(parts.join(' '));
  }

  function index(rec) {
    rec._blob = buildBlob(rec);
    byId[rec.id] = rec;
    return rec;
  }

  function reindexHistory() {
    historyByCase = {};
    state.history.forEach(function (h) {
      (historyByCase[h.caseId] = historyByCase[h.caseId] || []).push(h);
    });
    Object.keys(historyByCase).forEach(function (k) {
      historyByCase[k].sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    });
  }

  // ------------------------------------------------------------------ تاریخچه
  function diff(before, after) {
    var changes = [];
    FIELDS.forEach(function (f) {
      var a = (before && before[f.key]) || '';
      var b = (after && after[f.key]) || '';
      if (String(a) !== String(b)) {
        changes.push({ field: f.key, label: f.label, from: String(a), to: String(b) });
      }
    });
    return changes;
  }

  /** ثبت رویداد در تاریخچه و ذخیرهٔ فوری آن */
  function logEvent(kind, rec, changes, note) {
    var entry = addHistory(kind, rec, changes, note);
    w.Store.put('history', [entry]);
    w.Store.scheduleSave();
    return entry;
  }

  function addHistory(kind, rec, changes, note) {
    var entry = {
      id: w.U.uid(),
      caseId: rec.id,
      caseNo: rec.caseNo || '',
      at: new Date().toISOString(),
      atJalali: w.J.stamp(),
      user: state.settings.user || 'کاربر',
      kind: kind,
      changes: changes || [],
      note: note || ''
    };
    state.history.push(entry);
    (historyByCase[entry.caseId] = historyByCase[entry.caseId] || []).push(entry);
    return entry;
  }

  function historyFor(caseId) { return historyByCase[caseId] || []; }

  /** تایم‌لاین = رویدادهای مرحله‌ای (از فیلدهای تاریخ) + تاریخچهٔ ویرایش */
  function timelineFor(rec) {
    var items = [];
    (w.MILESTONES || []).forEach(function (m) {
      var v = rec[m.key];
      if (v && w.J.unpack(v)) {
        items.push({ type: 'milestone', date: v, label: m.label, sortKey: v + '0' });
      }
    });
    if (w.Docs) {
      w.Docs.forCase(rec.id).forEach(function (d) {
        if (d.superseded || !d.docDate || !w.J.unpack(d.docDate)) return;
        items.push({ type: 'doc', date: d.docDate, doc: d, sortKey: d.docDate + '0' });
      });
    }
    historyFor(rec.id).forEach(function (h) {
      // atJalali با ارقام فارسی ذخیره می‌شود؛ باید اول لاتین شود
      var d = w.U.toLatinDigits(h.atJalali || '').replace(/[^0-9]/g, '').slice(0, 8);
      items.push({ type: 'history', date: d, entry: h, sortKey: d + '1' + h.at });
    });
    items.sort(function (a, b) { return a.sortKey < b.sortKey ? -1 : 1; });
    return items;
  }

  // --------------------------------------------------------------- عملیات CRUD
  /**
   * کلیدهایی که فیلد فرم نیستند ولی روی پرونده می‌مانند و نباید با
   * ویرایش از بین بروند (مثلاً نام پوشهٔ مستندات روی دیسک).
   */
  var SYSTEM_KEYS = ['docFolder'];

  function normalizeRecord(rec) {
    var out = {};
    FIELDS.forEach(function (f) {
      var v = rec[f.key];
      if (v == null) return;
      v = String(v).trim();
      if (!v) return;
      out[f.key] = (f.type === 'date') ? w.J.parse(v) : v;
    });
    SYSTEM_KEYS.forEach(function (k) {
      if (rec[k] != null && rec[k] !== '') out[k] = rec[k];
    });
    out.id = rec.id;
    return out;
  }

  /** هر تغییری در پرونده‌ها، نمایهٔ اشخاص را بی‌اعتبار می‌کند */
  function invalidatePeople() {
    if (w.Person) w.Person.invalidate();
  }

  function markChange() {
    invalidatePeople();
    state.settings.changesSinceBackup = (state.settings.changesSinceBackup || 0) + 1;
    w.Store.metaSet('settings', state.settings);
    w.Store.scheduleSave();
  }

  function create(data) {
    var rec = normalizeRecord(data);
    rec.id = rec.id || w.U.uid();
    rec.createdAt = new Date().toISOString();
    rec.updatedAt = rec.createdAt;
    index(rec);
    state.cases.push(rec);
    var entry = addHistory('create', rec, diff(null, rec), 'ثبت پروندهٔ جدید');
    return Promise.all([
      w.Store.put('cases', [strip(rec)]),
      w.Store.put('history', [entry])
    ]).then(function () { markChange(); return rec; });
  }

  function update(id, data) {
    var before = byId[id];
    if (!before) return Promise.reject(new Error('پرونده پیدا نشد'));
    var after = normalizeRecord(data);
    after.id = id;
    after.createdAt = before.createdAt;
    // اگر فراخوان کلید سیستمی را نفرستاده، از رکورد قبلی نگه داشته می‌شود
    SYSTEM_KEYS.forEach(function (k) {
      if (after[k] == null && before[k] != null) after[k] = before[k];
    });
    var changes = diff(before, after);
    if (!changes.length) return Promise.resolve({ record: before, changes: [] });
    after.updatedAt = new Date().toISOString();
    Object.keys(before).forEach(function (k) {
      if (k[0] !== '_' && !(k in after) && ['id', 'createdAt', 'updatedAt'].indexOf(k) < 0) {
        delete before[k];
      }
    });
    var idx = state.cases.indexOf(before);
    index(after);
    if (idx >= 0) state.cases[idx] = after; else state.cases.push(after);
    var entry = addHistory('update', after, changes);
    return Promise.all([
      w.Store.put('cases', [strip(after)]),
      w.Store.put('history', [entry])
    ]).then(function () { markChange(); return { record: after, changes: changes }; });
  }

  function remove(id) {
    var rec = byId[id];
    if (!rec) return Promise.resolve(false);
    var entry = addHistory('delete', rec, [], 'حذف پرونده');
    state.cases = state.cases.filter(function (c) { return c.id !== id; });
    delete byId[id];
    return Promise.all([
      w.Store.remove('cases', [id]),
      w.Store.put('history', [entry])
    ]).then(function () { markChange(); return true; });
  }

  /** نسخهٔ قابل ذخیره (بدون فیلدهای کمکی) */
  function strip(rec) {
    var out = {};
    Object.keys(rec).forEach(function (k) { if (k[0] !== '_') out[k] = rec[k]; });
    return out;
  }

  function get(id) { return byId[id]; }

  // ------------------------------------------------------------ جستجو و فیلتر
  function tokenize(q) {
    return w.U.normalize(q).split(' ').filter(Boolean);
  }

  // «رسیده به این مرحله یا فراتر» — هم‌معنا با قیف گزارش
  var STAGE_FIELDS = {
    assigned: ['deliveryDate', 'committeeDate', 'noticeLetterDate'],
    committee: ['committeeDate', 'noticeLetterDate'],
    notified: ['noticeLetterDate']
  };

  function matches(rec, tokens, filters) {
    for (var k in filters) {
      // کلیدهای با زیرخط، فیلترهای ویژه‌اند و جداگانه بررسی می‌شوند
      if (k.charAt(0) === '_') continue;
      if (!filters[k] || !filters[k].length) continue;
      if (filters[k].indexOf(rec[k] || '') < 0) return false;
    }
    if (filters._from || filters._to) {
      var dv = rec[filters._dateField || 'intakeDate'];
      if (!dv) return false;
      if (filters._from && dv < filters._from) return false;
      if (filters._to && dv > filters._to) return false;
    }
    if (filters._idSet && !filters._idSet[rec.id]) return false;
    if (filters._stage && filters._stage !== 'all') {
      var fields = STAGE_FIELDS[filters._stage];
      if (fields && !fields.some(function (f) { return !!rec[f]; })) return false;
    }
    for (var i = 0; i < tokens.length; i++) {
      if (rec._blob.indexOf(tokens[i]) < 0) return false;
    }
    return true;
  }

  function compare(a, b, key, dir) {
    var va = a[key] || '', vb = b[key] || '';
    var na = +w.U.toLatinDigits(va), nb = +w.U.toLatinDigits(vb);
    var r;
    if (va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb)) r = na - nb;
    else r = String(va).localeCompare(String(vb), 'fa');
    if (r === 0) return 0;
    return dir === 'desc' ? -r : r;
  }

  /** آرایهٔ شناسه را به نگاشت سریع تبدیل می‌کند */
  function idSet(ids) {
    var out = Object.create(null);
    (ids || []).forEach(function (id) { out[id] = true; });
    return out;
  }

  function query(opts) {
    var tokens = tokenize(opts.q || '');
    var filters = opts.filters || {};
    var out = state.cases.filter(function (rec) { return matches(rec, tokens, filters); });
    var key = opts.sortKey || 'caseNo';
    var dir = opts.sortDir || 'asc';
    out.sort(function (a, b) {
      var r = compare(a, b, key, dir);
      return r !== 0 ? r : compare(a, b, 'caseNo', 'asc');
    });
    return out;
  }

  /** مقادیر یکتای یک فیلد در کل داده‌ها (برای فیلترها و تکمیل خودکار) */
  function distinct(key) {
    var seen = Object.create(null), out = [];
    state.cases.forEach(function (c) {
      var v = c[key];
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    });
    return out.sort(function (a, b) { return String(a).localeCompare(String(b), 'fa'); });
  }

  /** گزینه‌های یک فیلد کشویی = لیست تعریف‌شده + مقادیر موجود در داده */
  function optionsFor(field) {
    var base = (state.lists[field.list] || []).slice();
    distinct(field.key).forEach(function (v) {
      if (base.indexOf(v) < 0) base.push(v);
    });
    return base;
  }

  /** پرونده‌های دیگر همین فرد — تعریف واحد در لایهٔ «شخص» */
  function relatedCases(rec) {
    if (!w.Person) return [];
    return w.Person.otherCases(rec);
  }

  function duplicateCaseNo(caseNo, excludeId) {
    if (!caseNo) return null;
    var n = w.U.normalize(caseNo);
    return state.cases.filter(function (c) {
      return c.id !== excludeId && w.U.normalize(c.caseNo || '') === n;
    })[0] || null;
  }

  // ------------------------------------------------------------------ آمار
  function stats() {
    var byStatus = {}, byExpert = {}, byYear = {}, total = state.cases.length;
    state.cases.forEach(function (c) {
      var s = c.status || 'نامشخص';
      byStatus[s] = (byStatus[s] || 0) + 1;
      var e = c.expert || 'نامشخص';
      byExpert[e] = (byExpert[e] || 0) + 1;
      var y = c.year || (c.intakeDate ? c.intakeDate.slice(0, 4) : 'نامشخص');
      byYear[y] = (byYear[y] || 0) + 1;
    });
    return { total: total, byStatus: byStatus, byExpert: byExpert, byYear: byYear };
  }

  /** پرونده‌های بدون رأی که بیش از N روز از ورودشان گذشته */
  function stale(days) {
    var today = w.J.today();
    return state.cases.filter(function (c) {
      if (c.committeeDate) return false;
      if (!c.intakeDate) return false;
      var d = w.J.diffDays(today, c.intakeDate);
      return d != null && d > days;
    }).map(function (c) {
      return { rec: c, days: w.J.diffDays(today, c.intakeDate) };
    }).sort(function (a, b) { return b.days - a.days; });
  }

  // ------------------------------------------------------------------ بارگذاری
  function load() {
    return Promise.all([
      w.Store.getAll('cases'),
      w.Store.getAll('history')
    ]).then(function (res) {
      state.cases = (res[0] || []).map(index);
      state.history = (res[1] || []);
      reindexHistory();
      invalidatePeople();
      state.lists = w.Store.metaGet('lists', null) || JSON.parse(JSON.stringify(w.DEFAULT_LISTS));
      state.columns = w.Store.metaGet('columns', null) || w.DEFAULT_COLUMNS.slice();
      var saved = w.Store.metaGet('settings', null);
      if (saved) Object.keys(saved).forEach(function (k) { state.settings[k] = saved[k]; });
      return state;
    });
  }

  /** بارگذاری داده‌های نمونه (فقط وقتی دیتابیس خالی است) */
  function seed() {
    if (state.cases.length || !w.SEED_CASES) return Promise.resolve(0);
    var now = new Date().toISOString();
    var records = w.SEED_CASES.map(function (raw) {
      var rec = normalizeRecord(raw);
      rec.id = w.U.uid();
      rec.createdAt = now;
      rec.updatedAt = now;
      return index(rec);
    });
    var entries = records.map(function (rec) {
      return {
        id: w.U.uid(), caseId: rec.id, caseNo: rec.caseNo || '', at: now,
        atJalali: w.J.stamp(), user: 'سیستم', kind: 'import',
        changes: [], note: 'ورود اولیه از فایل اکسل'
      };
    });
    state.cases = records;
    state.history = entries;
    reindexHistory();
    invalidatePeople();
    return Promise.all([
      w.Store.put('cases', records.map(strip)),
      w.Store.put('history', entries)
    ]).then(function () { return records.length; });
  }

  /**
   * تحلیل یک دسته رکورد پیش از ورود، بدون تغییر دادن چیزی.
   * سه دسته برمی‌گرداند: تازه، تکراری با پروندهٔ موجود، و تکراری داخل خود فایل.
   */
  function analyzeImport(records) {
    var fresh = [], existing = [], insideFile = [], noCaseNo = [];
    var seen = Object.create(null);
    records.forEach(function (raw, i) {
      var rec = normalizeRecord(raw);
      var row = { index: i, rec: rec, caseNo: rec.caseNo || '' };
      if (!row.caseNo) { noCaseNo.push(row); return; }
      var norm = w.U.normalize(row.caseNo);
      if (seen[norm]) {
        row.firstRow = seen[norm];
        insideFile.push(row);
        return;
      }
      seen[norm] = row;
      var dup = duplicateCaseNo(row.caseNo, null);
      if (dup) {
        row.existing = dup;
        row.changes = diff(dup, Object.assign({}, dup, rec));
        existing.push(row);
        return;
      }
      fresh.push(row);
    });
    return {
      total: records.length, fresh: fresh, existing: existing,
      insideFile: insideFile, noCaseNo: noCaseNo,
      changed: existing.filter(function (r) { return r.changes.length; })
    };
  }

  /**
   * ورود دسته‌ای. onDuplicate:
   *   'skip'   — پروندهٔ تکراری رد می‌شود (پیش‌فرض، جلوی کپی شدن را می‌گیرد)
   *   'update' — پروندهٔ موجود با مقادیر تازه به‌روز می‌شود و تغییرش ثبت می‌گردد
   */
  function bulkImport(records, opts) {
    opts = opts || {};
    var onDuplicate = opts.onDuplicate || 'skip';
    var note = opts.note;
    var analysis = analyzeImport(records);
    var now = new Date().toISOString();
    var touched = [], entries = [], updated = 0, skipped = 0;

    analysis.fresh.forEach(function (row) {
      var rec = row.rec;
      rec.id = w.U.uid();
      rec.createdAt = now;
      rec.updatedAt = now;
      index(rec);
      state.cases.push(rec);
      touched.push(rec);
      entries.push({
        id: w.U.uid(), caseId: rec.id, caseNo: rec.caseNo || '', at: now,
        atJalali: w.J.stamp(), user: state.settings.user || 'کاربر', kind: 'import',
        changes: [], note: note || 'ورود از فایل اکسل'
      });
    });

    analysis.existing.forEach(function (row) {
      if (onDuplicate !== 'update' || !row.changes.length) { skipped++; return; }
      var target = row.existing;
      Object.keys(row.rec).forEach(function (k) {
        if (k !== 'id') target[k] = row.rec[k];
      });
      target.updatedAt = now;
      index(target);
      touched.push(target);
      entries.push({
        id: w.U.uid(), caseId: target.id, caseNo: target.caseNo, at: now,
        atJalali: w.J.stamp(), user: state.settings.user || 'کاربر', kind: 'update',
        changes: row.changes, note: note || 'به‌روزرسانی از فایل اکسل'
      });
      updated++;
    });

    // ردیف‌های تکراری داخل خود فایل هرگز دو بار ثبت نمی‌شوند
    skipped += analysis.insideFile.length + analysis.noCaseNo.length;

    state.history = state.history.concat(entries);
    reindexHistory();
    return Promise.all([
      touched.length ? w.Store.put('cases', touched.map(strip)) : null,
      entries.length ? w.Store.put('history', entries) : null
    ]).then(function () {
      markChange();
      return {
        added: analysis.fresh.length, updated: updated, skipped: skipped,
        duplicatesInFile: analysis.insideFile.length,
        withoutCaseNo: analysis.noCaseNo.length
      };
    });
  }

  function saveLists(lists) {
    state.lists = lists;
    return w.Store.metaSet('lists', lists).then(function () { w.Store.scheduleSave(); });
  }

  function saveColumns(cols) {
    state.columns = cols;
    return w.Store.metaSet('columns', cols).then(function () { w.Store.scheduleSave(); });
  }

  function saveSettings(patch) {
    Object.keys(patch).forEach(function (k) { state.settings[k] = patch[k]; });
    return w.Store.metaSet('settings', state.settings);
  }

  function reload() {
    byId = {};
    return load();
  }

  /**
   * پاک کردن همهٔ داده‌های رمزگشایی‌شده از حافظه.
   * هنگام قفل کردن لازم است؛ وگرنه محتوای پرونده‌ها در حافظهٔ صفحه می‌ماند و
   * قفل فقط ظاهری می‌شود.
   */
  function clearMemory() {
    state.cases = [];
    state.history = [];
    byId = {};
    historyByCase = {};
    invalidatePeople();
  }

  w.Model = {
    state: state, FIELDS: FIELDS, FIELD_BY_KEY: FIELD_BY_KEY, DATE_KEYS: DATE_KEYS,
    load: load, reload: reload, clearMemory: clearMemory, seed: seed,
    bulkImport: bulkImport,
    create: create, update: update, remove: remove, get: get, query: query,
    analyzeImport: analyzeImport,
    idSet: idSet, reindex: index, addHistory: logEvent,
    distinct: distinct, optionsFor: optionsFor, relatedCases: relatedCases,
    duplicateCaseNo: duplicateCaseNo, historyFor: historyFor, timelineFor: timelineFor,
    stats: stats, stale: stale, strip: strip, diff: diff,
    saveLists: saveLists, saveColumns: saveColumns, saveSettings: saveSettings
  };
})(window);
