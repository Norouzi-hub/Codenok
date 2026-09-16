/*
 * لایهٔ داده: IndexedDB به‌عنوان انبار کاری + ذخیرهٔ خودکار روی یک فایل
 * روی دیسک کاربر (File System Access API در کروم/اج).
 * اگر IndexedDB در دسترس نباشد به localStorage و سپس حافظه سقوط می‌کند.
 */
(function (w) {
  'use strict';

  var DB_NAME = 'parvandeha';
  var DB_VERSION = 2;
  var LS_KEY = 'parvandeha:snapshot';
  var SCHEMA_VERSION = 1;

  var db = null;
  var mode = 'memory';          // idb | localStorage | memory
  var mem = { cases: {}, history: {}, docs: {}, meta: {} };

  // ---------------------------------------------------------------- IndexedDB

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!w.indexedDB) return reject(new Error('IndexedDB در دسترس نیست'));
      var req = w.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('cases')) {
          var cs = d.createObjectStore('cases', { keyPath: 'id' });
          cs.createIndex('caseNo', 'caseNo', { unique: false });
          cs.createIndex('nationalId', 'nationalId', { unique: false });
          cs.createIndex('status', 'status', { unique: false });
        }
        if (!d.objectStoreNames.contains('history')) {
          var hs = d.createObjectStore('history', { keyPath: 'id' });
          hs.createIndex('caseId', 'caseId', { unique: false });
        }
        if (!d.objectStoreNames.contains('meta')) {
          d.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('docs')) {
          var ds = d.createObjectStore('docs', { keyPath: 'id' });
          ds.createIndex('caseId', 'caseId', { unique: false });
          ds.createIndex('chain', 'chain', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('باز کردن دیتابیس ناموفق بود')); };
      req.onblocked = function () { reject(new Error('دیتابیس توسط تب دیگری قفل شده است')); };
    });
  }

  function tx(stores, writable) {
    return db.transaction(stores, writable ? 'readwrite' : 'readonly');
  }

  function reqp(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function idbAll(store) { return reqp(tx([store]).objectStore(store).getAll()); }

  function idbPut(store, values) {
    return new Promise(function (resolve, reject) {
      var t = tx([store], true), os = t.objectStore(store);
      values.forEach(function (v) { os.put(v); });
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error); };
    });
  }

  function idbDelete(store, keys) {
    return new Promise(function (resolve, reject) {
      var t = tx([store], true), os = t.objectStore(store);
      keys.forEach(function (k) { os.delete(k); });
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error); };
    });
  }

  function idbClear(stores) {
    return new Promise(function (resolve, reject) {
      var t = tx(stores, true);
      stores.forEach(function (s) { t.objectStore(s).clear(); });
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error); };
    });
  }

  // ------------------------------------------------------- سقوط به localStorage

  function lsRead() {
    try {
      var raw = w.localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function lsWrite() {
    try {
      w.localStorage.setItem(LS_KEY, JSON.stringify({
        cases: Object.keys(mem.cases).map(function (k) { return mem.cases[k]; }),
        history: Object.keys(mem.history).map(function (k) { return mem.history[k]; }),
        docs: Object.keys(mem.docs).map(function (k) { return mem.docs[k]; }),
        meta: Object.keys(mem.meta).map(function (k) { return mem.meta[k]; })
      }));
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------- API عام

  function getAll(store) {
    if (mode === 'idb') return idbAll(store);
    return Promise.resolve(Object.keys(mem[store]).map(function (k) { return mem[store][k]; }));
  }

  function put(store, values) {
    values.forEach(function (v) {
      mem[store][store === 'meta' ? v.key : v.id] = v;
    });
    if (mode === 'idb') return idbPut(store, values);
    if (mode === 'localStorage') lsWrite();
    return Promise.resolve();
  }

  function remove(store, keys) {
    keys.forEach(function (k) { delete mem[store][k]; });
    if (mode === 'idb') return idbDelete(store, keys);
    if (mode === 'localStorage') lsWrite();
    return Promise.resolve();
  }

  function clearAll() {
    mem = { cases: {}, history: {}, docs: {}, meta: mem.meta };
    if (mode === 'idb') return idbClear(['cases', 'history', 'docs']);
    if (mode === 'localStorage') lsWrite();
    return Promise.resolve();
  }

  function metaGet(key, fallback) {
    var m = mem.meta[key];
    return m === undefined ? fallback : m.value;
  }

  function metaSet(key, value) { return put('meta', [{ key: key, value: value }]); }

  // ---------------------------------------------------- فایل پشتیبان روی دیسک

  var fileHandle = null;
  var fileName = '';
  var lastSavedAt = null;
  var saveError = null;
  var listeners = [];

  function onStatusChange(fn) { listeners.push(fn); }
  function emit() {
    listeners.forEach(function (fn) { fn(status()); });
  }

  function supportsFileSystem() {
    return typeof w.showSaveFilePicker === 'function';
  }

  function status() {
    return {
      mode: mode,
      linked: !!fileHandle,
      fileName: fileName,
      lastSavedAt: lastSavedAt,
      error: saveError,
      canLink: supportsFileSystem(),
      hasStored: hasStoredFile(),
      storedName: storedFileName()
    };
  }

  // ارجاع‌های سیستم فایل قابل تبدیل به JSON نیستند و در پشتیبان نمی‌آیند
  var HANDLE_KEYS = ['fileHandle', 'docsFolder'];

  function snapshot() {
    return {
      app: 'parvandeha',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      cases: Object.keys(mem.cases).map(function (k) { return mem.cases[k]; }),
      history: Object.keys(mem.history).map(function (k) { return mem.history[k]; }),
      docs: Object.keys(mem.docs).map(function (k) { return mem.docs[k]; }),
      meta: Object.keys(mem.meta)
        .filter(function (k) { return HANDLE_KEYS.indexOf(k) < 0; })
        .map(function (k) { return mem.meta[k]; })
    };
  }

  function verifyPermission(handle, forWrite) {
    var opts = { mode: forWrite ? 'readwrite' : 'read' };
    return handle.queryPermission(opts).then(function (state) {
      if (state === 'granted') return true;
      return handle.requestPermission(opts).then(function (s) { return s === 'granted'; });
    });
  }

  /** انتخاب فایل دیتابیس روی دیسک توسط کاربر (کروم/اج). */
  function linkFile() {
    if (!supportsFileSystem()) {
      return Promise.reject(new Error('این مرورگر از ذخیرهٔ مستقیم روی فایل پشتیبانی نمی‌کند'));
    }
    return w.showSaveFilePicker({
      suggestedName: 'parvandeha-db.json',
      types: [{ description: 'دیتابیس پرونده‌ها', accept: { 'application/json': ['.json'] } }]
    }).then(function (handle) {
      fileHandle = handle;
      fileName = handle.name;
      saveError = null;
      return metaSet('fileHandle', handle);
    }).then(function () {
      return writeFile();
    }).then(function () { emit(); return true; });
  }

  function unlinkFile() {
    fileHandle = null;
    fileName = '';
    return metaSet('fileHandle', null).then(emit);
  }

  /** آیا فایلی از نشست قبل ذخیره شده که فقط اجازه‌اش لازم است؟ */
  function hasStoredFile() {
    var h = metaGet('fileHandle', null);
    return !!(h && h.queryPermission);
  }

  function storedFileName() {
    var h = metaGet('fileHandle', null);
    return h ? h.name : '';
  }

  /**
   * فایل نشست قبل را دوباره وصل می‌کند.
   * interactive=false هنگام راه‌اندازی (بدون کنش کاربر، فقط اگر اجازه از قبل
   * هست)؛ interactive=true وقتی کاربر دکمه‌ای زده و می‌شود اجازه خواست.
   */
  function relinkFile(interactive) {
    var handle = metaGet('fileHandle', null);
    if (!handle || !handle.queryPermission) return Promise.resolve(false);
    var check = interactive
      ? verifyPermission(handle, true)
      : handle.queryPermission({ mode: 'readwrite' }).then(function (state) {
        return state === 'granted';
      });
    return check.then(function (ok) {
      if (!ok) return false;
      fileHandle = handle;
      fileName = handle.name;
      saveError = null;
      emit();
      return true;
    }).catch(function () { return false; });
  }

  function writeFile() {
    if (!fileHandle) return Promise.resolve(false);
    var text = JSON.stringify(snapshot());
    return fileHandle.createWritable().then(function (wr) {
      return wr.write(new Blob([text], { type: 'application/json' })).then(function () {
        return wr.close();
      });
    }).then(function () {
      lastSavedAt = new Date();
      saveError = null;
      emit();
      return true;
    }).catch(function (err) {
      saveError = err.message || String(err);
      emit();
      throw err;
    });
  }

  var flushTimer = null;
  var dirty = false;

  /** بعد از هر تغییر صدا زده می‌شود؛ نوشتن روی فایل را با تأخیر جمع می‌بندد. */
  function scheduleSave() {
    if (!fileHandle) { dirty = true; emit(); return; }
    dirty = true;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () {
      writeFile().then(function () { dirty = false; }).catch(function () { });
    }, 1200);
  }

  function flushNow() {
    clearTimeout(flushTimer);
    if (!fileHandle || !dirty) return Promise.resolve(false);
    return writeFile().then(function () { dirty = false; return true; });
  }

  function isDirty() { return dirty; }

  // -------------------------------------------------------------------- init

  function init() {
    return openDb().then(function (d) {
      db = d;
      mode = 'idb';
      return Promise.all([idbAll('cases'), idbAll('history'), idbAll('meta'),
        idbAll('docs')]);
    }).catch(function (err) {
      // IndexedDB در دسترس نیست (مثلاً حالت ناشناس یا سیاست مرورگر)
      console.warn('IndexedDB در دسترس نبود:', err && err.message);
      var snap = lsRead();
      try {
        w.localStorage.setItem(LS_KEY + ':probe', '1');
        w.localStorage.removeItem(LS_KEY + ':probe');
        mode = 'localStorage';
      } catch (e) {
        mode = 'memory';
      }
      return [snap ? snap.cases : [], snap ? snap.history : [], snap ? snap.meta : [],
        snap ? snap.docs : []];
    }).then(function (res) {
      (res[0] || []).forEach(function (c) { mem.cases[c.id] = c; });
      (res[1] || []).forEach(function (h) { mem.history[h.id] = h; });
      (res[2] || []).forEach(function (m) { mem.meta[m.key] = m; });
      (res[3] || []).forEach(function (d) { mem.docs[d.id] = d; });
      return relinkFile(false);
    }).then(function () {
      return status();
    });
  }

  /** جایگزینی کامل داده‌ها از روی یک پشتیبان. */
  function restore(snap) {
    if (!snap || snap.app !== 'parvandeha') {
      return Promise.reject(new Error('فایل پشتیبان معتبر نیست'));
    }
    return clearAll().then(function () {
      return put('cases', snap.cases || []);
    }).then(function () {
      return put('history', snap.history || []);
    }).then(function () {
      return (snap.docs && snap.docs.length) ? put('docs', snap.docs) : null;
    }).then(function () {
      var metas = (snap.meta || []).filter(function (m) {
        return HANDLE_KEYS.indexOf(m.key) < 0;
      });
      return metas.length ? put('meta', metas) : null;
    }).then(function () { scheduleSave(); });
  }

  w.Store = {
    init: init, getAll: getAll, put: put, remove: remove, clearAll: clearAll,
    metaGet: metaGet, metaSet: metaSet, snapshot: snapshot, restore: restore,
    linkFile: linkFile, unlinkFile: unlinkFile, writeFile: writeFile,
    hasStoredFile: hasStoredFile, storedFileName: storedFileName,
    scheduleSave: scheduleSave, flushNow: flushNow, isDirty: isDirty,
    status: status, onStatusChange: onStatusChange,
    supportsFileSystem: supportsFileSystem
  };
})(window);
