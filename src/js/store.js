/*
 * لایهٔ داده: IndexedDB به‌عنوان انبار کاری + ذخیرهٔ خودکار روی یک فایل
 * روی دیسک کاربر (File System Access API در کروم/اج).
 * اگر IndexedDB در دسترس نباشد به localStorage و سپس حافظه سقوط می‌کند.
 */
(function (w) {
  'use strict';

  var DB_NAME = 'parvandeha';
  var DB_VERSION = 3;
  var LS_KEY = 'parvandeha:snapshot';
  var SCHEMA_VERSION = 1;

  var db = null;
  var mode = 'memory';          // idb | localStorage | memory
  // این انبارها محتوای پرونده‌ای دارند و وقتی رمز فعال باشد رمز می‌شوند.
  // انبار meta رمز نمی‌شود؛ خودِ تنظیمات قفل آنجاست.
  var SECRET_STORES = ['cases', 'history', 'docs', 'notes'];
  var KEY_FIELD = { cases: 'id', history: 'id', docs: 'id', notes: 'id' };
  var mem = { cases: {}, history: {}, docs: {}, notes: {}, meta: {} };

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
        if (!d.objectStoreNames.contains('notes')) {
          var ns = d.createObjectStore('notes', { keyPath: 'id' });
          ns.createIndex('caseId', 'caseId', { unique: false });
          ns.createIndex('followUp', 'followUp', { unique: false });
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
        notes: Object.keys(mem.notes).map(function (k) { return mem.notes[k]; }),
        meta: Object.keys(mem.meta).map(function (k) { return mem.meta[k]; })
      }));
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------- API عام

  function getAll(store) {
    if (mode !== 'idb') {
      return Promise.resolve(Object.keys(mem[store]).map(function (k) {
        return mem[store][k];
      }));
    }
    return idbAll(store).then(unsealAll);
  }

  function unsealAll(list) {
    if (!list || !list.length) return list || [];
    var hasSealed = list.some(function (r) { return r && r.__enc; });
    if (!hasSealed) return list;
    return Promise.all(list.map(function (r) { return w.Vault.openRecord(r); }));
  }

  function shouldSeal(store) {
    return SECRET_STORES.indexOf(store) >= 0 && w.Vault.isEnabled() &&
      w.Vault.isUnlocked();
  }

  function put(store, values) {
    values.forEach(function (v) {
      mem[store][store === 'meta' ? v.key : v.id] = v;
    });
    if (mode === 'localStorage') { lsWrite(); return Promise.resolve(); }
    if (mode !== 'idb') return Promise.resolve();
    if (!shouldSeal(store)) return idbPut(store, values);
    return Promise.all(values.map(function (v) {
      return w.Vault.sealRecord(v, KEY_FIELD[store] || 'id');
    })).then(function (sealed) { return idbPut(store, sealed); });
  }

  function remove(store, keys) {
    keys.forEach(function (k) { delete mem[store][k]; });
    if (mode === 'idb') return idbDelete(store, keys);
    if (mode === 'localStorage') lsWrite();
    return Promise.resolve();
  }

  /**
   * پاک کردن کامل ردّ برنامه از این مرورگر.
   *
   * چرا لازم است: صفحه‌هایی که با file:// باز می‌شوند همه یک «مبدأ» دارند.
   * یعنی دیتابیس به مرورگر بسته است نه به فایل — اگر فایل HTML را حذف کنید و
   * نسخهٔ تازه‌ای بگذارید، همان دیتابیس قبلی با همهٔ داده‌ها برمی‌گردد.
   * تنها راه پاک کردن واقعی، حذف خود دیتابیس است.
   */
  function wipeBrowser() {
    return new Promise(function (resolve) {
      try {
        Object.keys(w.localStorage).forEach(function (k) {
          if (k.indexOf('parvandeha') === 0) w.localStorage.removeItem(k);
        });
      } catch (e) { /* localStorage در دسترس نیست */ }

      if (db) { try { db.close(); } catch (e) { /* از قبل بسته */ } }
      db = null;
      mem = { cases: {}, history: {}, docs: {}, notes: {}, meta: {} };
      dataLoaded = false;
      fileHandle = null;
      fileName = '';
      w.Vault.clearPassword();

      if (!w.indexedDB) return resolve(true);
      var req = w.indexedDB.deleteDatabase(DB_NAME);
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(true); } };
      req.onsuccess = finish;
      req.onerror = finish;
      // اگر تب دیگری دیتابیس را باز نگه داشته باشد، حذف بلوکه می‌شود
      req.onblocked = finish;
      setTimeout(finish, 3000);
    });
  }

  /** نام دیتابیس، برای نمایش در تنظیمات */
  function dbName() { return DB_NAME; }

  function clearAll() {
    mem = { cases: {}, history: {}, docs: {}, notes: {}, meta: mem.meta };
    if (mode === 'idb') return idbClear(['cases', 'history', 'docs', 'notes']);
    if (mode === 'localStorage') lsWrite();
    return Promise.resolve();
  }

  function metaGet(key, fallback) {
    var m = mem.meta[key];
    return m === undefined ? fallback : m.value;
  }

  function metaSet(key, value) { return put('meta', [{ key: key, value: value }]); }

  /*
   * ارجاع فایل و پوشه را IndexedDB معمولاً می‌پذیرد (کروم این دسته‌ها را
   * structured-clone می‌کند)، ولی همه‌جا نه. اگر نشد، نباید کلِ وصل شدن
   * شکست بخورد: این نشست کار می‌کند و فقط دفعهٔ بعد باید دوباره انتخاب شود.
   */
  function rememberHandle(key, handle) {
    return metaSet(key, handle).catch(function (err) {
      console.warn('ارجاع ' + key + ' ذخیره نشد:', err && err.message);
      mem.meta[key] = { key: key, value: handle };
      return null;
    });
  }

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
      locked: w.Vault.needsPassword(),
      encrypted: w.Vault.isEnabled(),
      hasStored: hasStoredFile(),
      storedName: storedFileName()
    };
  }

  // ارجاع‌های سیستم فایل قابل تبدیل به JSON نیستند و در پشتیبان نمی‌آیند.
  // تنظیم رمز هم به همان نسخه گره نمی‌خورد: نسخهٔ پشتیبان با رمز خودش بسته
  // می‌شود و هنگام بازیابی، رمز نشست جاری اعمال می‌گردد.
  var HANDLE_KEYS = ['fileHandle', 'docsFolder', 'security'];

  /* رابط کاربری، پرسیدن رمزِ یک فایل را اینجا وصل می‌کند. لایهٔ داده خودش
     پنجره نمی‌سازد. */
  var askPassword = null;
  function onPasswordNeeded(fn) { askPassword = fn; }

  function snapshot() {
    return {
      app: 'parvandeha',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      cases: Object.keys(mem.cases).map(function (k) { return mem.cases[k]; }),
      history: Object.keys(mem.history).map(function (k) { return mem.history[k]; }),
      docs: Object.keys(mem.docs).map(function (k) { return mem.docs[k]; }),
      notes: Object.keys(mem.notes).map(function (k) { return mem.notes[k]; }),
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
      return rememberHandle('fileHandle', handle);
    }).then(function () {
      return writeFile();
    }).then(function () { emit(); return true; });
  }

  /**
   * باز کردن یک فایل دیتابیسِ موجود.
   *
   * جدا از linkFile است و باید هم باشد: linkFile با پنجرهٔ «ذخیره» کار
   * می‌کند و هرچه انتخاب شود را بازنویسی می‌کند. برای فایلی که از قبل داده
   * دارد، این فاجعه است. اینجا با پنجرهٔ «باز کردن» می‌آید و اول می‌خوانَد.
   */
  function openFile() {
    if (!supportsFileSystem() || !w.showOpenFilePicker) {
      return Promise.reject(new Error('این مرورگر از باز کردن فایل پشتیبانی نمی‌کند'));
    }
    return w.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'دیتابیس پرونده‌ها', accept: { 'application/json': ['.json'] } }]
    }).then(function (handles) {
      var handle = handles[0];
      return verifyPermission(handle, true).then(function (ok) {
        if (!ok) throw new Error('اجازهٔ نوشتن روی فایل داده نشد');
        fileHandle = handle;
        fileName = handle.name;
        saveError = null;
        return rememberHandle('fileHandle', handle);
      });
    }).then(function () {
      return readRaw();
    }).then(function (payload) {
      if (!payload || payload.app !== 'parvandeha') {
        throw new Error('این فایل، دیتابیس این برنامه نیست');
      }
      /* اگر فایل رمز دارد، رمزِ خودش پرسیده می‌شود — نه رمزِ این مرورگر.
         قفل به داده بسته است، پس در هر مرورگر و هر رایانه‌ای می‌آید. */
      if (!w.Vault.isSealed(payload)) {
        w.Vault.clearPassword();
        return metaSet('security', null).then(function () { return payload; });
      }
      if (!askPassword) throw new Error('این دیتابیس رمز دارد');
      return askPassword(fileName).then(function (pw) {
        if (!pw) throw new Error('بدون رمز، این دیتابیس باز نمی‌شود');
        return w.Vault.openAndAdopt(payload, pw).then(function (res) {
          return res.data;
        });
      });
    }).then(function (snap) {
      // فایلِ انتخاب‌شده صراحتاً خواستهٔ کاربر است، پس بی‌قید‌وشرط می‌نشیند
      return installSnapshot(snap);
    }).then(function () {
      emit();
      return { cases: Object.keys(mem.cases).length };
    });
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
      // اجازه که گرفته شد، محتوای فایل مبناست
      return adoptFile().then(function () { return true; });
    }).catch(function () { return false; });
  }

  /**
   * خواندن فایل دیتابیس از دیسک.
   *
   * تا امروز فایل فقط نوشته می‌شد و هیچ‌وقت خوانده نمی‌شد: منبعِ حقیقت،
   * IndexedDB مرورگر بود و فایل فقط یک آینه. نتیجه‌اش این بود که با عوض
   * کردن فایل HTML یا پاک شدن دادهٔ مرورگر، کار از دست می‌رفت — درحالی‌که
   * فایل سرِ جایش بود. حالا برعکس است: هر وقت فایل وصل باشد، همان مبناست.
   */
  function readRaw() {
    if (!fileHandle) return Promise.resolve(null);
    return fileHandle.getFile()
      .then(function (f) { return f.text(); })
      .then(function (text) {
        if (!text || !text.trim()) return null;
        return JSON.parse(text);
      })
      .catch(function (err) {
        saveError = 'خواندن فایل ناموفق بود: ' + (err.message || err);
        emit();
        return null;
      });
  }

  /** محتوای فایل، بازشده با کلیدی که همین حالا در دست است */
  function readFile() {
    return readRaw().then(function (payload) {
      if (!payload) return null;
      if (!w.Vault.isSealed(payload)) return payload;
      // بستهٔ رمزدار را بدون رمز نمی‌شود باز کرد؛ فراخوان باید رمز بگیرد
      return null;
    });
  }

  /** آیا فایلِ وصل‌شده رمز دارد؟ */
  function fileIsSealed() {
    return readRaw().then(function (p) { return w.Vault.isSealed(p); });
  }

  /** چند رکورد دارد — برای مقایسهٔ فایل با انبار مرورگر */
  function countOf(snap) {
    if (!snap) return -1;
    return (snap.cases || []).length + (snap.history || []).length +
      (snap.docs || []).length + (snap.notes || []).length;
  }

  /*
   * تازه‌ترین تغییرِ اینجا.
   *
   * اول این را با «آخرین باری که ما روی فایل نوشتیم» می‌سنجیدم، ولی آن
   * مقدار خودش داخل همان فایل ذخیره می‌شد و یک نسل عقب بود — نتیجه‌اش این
   * شد که فایلِ کهنه، دادهٔ تازه‌تر را می‌بلعید. مبنای درست، خودِ رکوردهاست:
   * اگر اینجا رکوردی هست که بعد از ساخته‌شدن فایل عوض شده، فایل عقب است.
   */
  function newestLocalChange() {
    var max = '';
    ['cases', 'history', 'docs', 'notes'].forEach(function (store) {
      Object.keys(mem[store]).forEach(function (k) {
        var r = mem[store][k] || {};
        var t = r.updatedAt || r.at || r.addedAt || r.createdAt || '';
        if (t > max) max = t;
      });
    });
    return max;
  }

  /**
   * فایل را با انبار مرورگر آشتی می‌دهد.
   *
   * قاعده ساده و محافظه‌کارانه است: فایل وقتی جایگزین می‌شود که تازه‌تر
   * باشد. «تازه‌تر» یعنی زمان صادرشدنش از آخرین نوشتنِ ما جلوتر است. اگر
   * انبار مرورگر خالی باشد، فایل بی‌چون‌وچرا می‌نشیند — همان حالتی که
   * کاربر فایل HTML را عوض کرده و مرورگر چیزی ندارد.
   */
  /** یک snapshot را روی حافظه و انبار می‌نشاند */
  function installSnapshot(snap) {
    mem.cases = {};
    mem.history = {};
    mem.docs = {};
    mem.notes = {};
    (snap.cases || []).forEach(function (c) { mem.cases[c.id] = c; });
    (snap.history || []).forEach(function (h) { mem.history[h.id] = h; });
    (snap.docs || []).forEach(function (d) { mem.docs[d.id] = d; });
    (snap.notes || []).forEach(function (n) { mem.notes[n.id] = n; });
    (snap.meta || []).forEach(function (m) {
      if (HANDLE_KEYS.indexOf(m.key) < 0) mem.meta[m.key] = m;
    });
    return clearAll()
      .then(function () { return put('cases', snap.cases || []); })
      .then(function () { return put('history', snap.history || []); })
      .then(function () {
        return (snap.docs || []).length ? put('docs', snap.docs) : null;
      })
      .then(function () {
        return (snap.notes || []).length ? put('notes', snap.notes) : null;
      })
      .then(function () {
        var metas = (snap.meta || []).filter(function (m) {
          return HANDLE_KEYS.indexOf(m.key) < 0;
        });
        return metas.length ? put('meta', metas) : null;
      })
      .then(function () {
        // رمزِ فایل، رمزِ این مرورگر هم می‌شود: قفل به داده بسته است نه به مرورگر
        var cfg = w.Vault.getConfig();
        return cfg ? metaSet('security', cfg) : null;
      });
  }

  function adoptFile() {
    return readFile().then(function (snap) {
      if (!snap || snap.app !== 'parvandeha') return false;
      var here = Object.keys(mem.cases).length + Object.keys(mem.history).length +
        Object.keys(mem.docs).length + Object.keys(mem.notes).length;
      var mine = newestLocalChange();
      var theirs = snap.exportedAt || '';
      // انبار خالی: فایل بی‌چون‌وچرا. وگرنه فقط اگر فایل جلوتر باشد.
      var newer = !here || (theirs && (!mine || theirs > mine));
      if (!newer) return false;
      if (countOf(snap) < 0) return false;
      // انبار مرورگر فقط یک کَش است؛ با همان چیزی که از فایل آمد پر می‌شود
      return installSnapshot(snap).then(function () { return true; });
    });
  }

  function writeFile() {
    if (!fileHandle) return Promise.resolve(false);
    return w.Vault.sealSnapshot(snapshot()).then(function (payload) {
      return writeText(JSON.stringify(payload));
    });
  }

  function writeText(text) {
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

  var dataLoaded = false;

  /** بارگذاری داده‌های پرونده‌ای؛ فقط وقتی قفل باز است */
  function loadData() {
    if (mode !== 'idb') { dataLoaded = true; return Promise.resolve(status()); }
    return Promise.all([idbAll('cases'), idbAll('history'), idbAll('docs'),
      idbAll('notes')])
      .then(function (res) {
        return Promise.all([unsealAll(res[0]), unsealAll(res[1]), unsealAll(res[2]),
          unsealAll(res[3])]);
      })
      .then(function (res) {
        mem.cases = {};
        mem.history = {};
        mem.docs = {};
        mem.notes = {};
        (res[0] || []).forEach(function (c) { mem.cases[c.id] = c; });
        (res[1] || []).forEach(function (h) { mem.history[h.id] = h; });
        (res[2] || []).forEach(function (d) { mem.docs[d.id] = d; });
        (res[3] || []).forEach(function (n) { mem.notes[n.id] = n; });
        dataLoaded = true;
        return relinkFile(false);
      })
      .then(function (linked) {
        // فایل وصل شد و اجازه‌اش از قبل بود: همان مبناست، نه انبار مرورگر
        return linked ? adoptFile() : false;
      })
      .then(function () { return status(); });
  }

  function init() {
    return openDb().then(function (d) {
      db = d;
      mode = 'idb';
      return idbAll('meta');
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
      if (snap) {
        (snap.cases || []).forEach(function (c) { mem.cases[c.id] = c; });
        (snap.history || []).forEach(function (h) { mem.history[h.id] = h; });
        (snap.docs || []).forEach(function (d) { mem.docs[d.id] = d; });
        (snap.notes || []).forEach(function (n) { mem.notes[n.id] = n; });
      }
      return snap ? (snap.meta || []) : [];
    }).then(function (metas) {
      (metas || []).forEach(function (m) { mem.meta[m.key] = m; });
      w.Vault.configure(metaGet('security', null));
      if (w.Vault.needsPassword()) return status();   // منتظر رمز کاربر
      return loadData();
    });
  }

  /** باز کردن قفل و سپس بارگذاری داده‌ها */
  function unlock(password) {
    return w.Vault.unlock(password).then(function (ok) {
      if (!ok) return false;
      return loadData().then(function () { return true; });
    });
  }

  /** قفل کردن: کلید و داده‌های در حافظه پاک می‌شوند */
  function lock() {
    return flushNow().catch(function () { }).then(function () {
      w.Vault.lock();
      mem.cases = {};
      mem.history = {};
      mem.docs = {};
      mem.notes = {};
      dataLoaded = false;
      fileHandle = null;
      fileName = '';
      emit();
    });
  }

  function isLocked() { return w.Vault.needsPassword(); }
  function isLoaded() { return dataLoaded; }

  /** نوشتن دوبارهٔ همهٔ رکوردها، پس از تعیین یا برداشتن رمز */
  function rewriteAll() {
    if (mode !== 'idb') { lsWrite(); return Promise.resolve(); }
    return SECRET_STORES.reduce(function (chain, store) {
      return chain.then(function () {
        var values = Object.keys(mem[store]).map(function (k) { return mem[store][k]; });
        if (!values.length) return null;
        return idbClear([store]).then(function () { return put(store, values); });
      });
    }, Promise.resolve());
  }

  /** تعیین رمز تازه و رمزگذاری دوبارهٔ داده‌های موجود */
  function setPassword(password) {
    return w.Vault.setPassword(password).then(function (cfg) {
      return metaSet('security', cfg);
    }).then(rewriteAll).then(function () {
      scheduleSave();
      emit();
      return true;
    });
  }

  /** برداشتن رمز و بازنویسی داده‌ها به شکل ساده */
  function clearPassword() {
    w.Vault.clearPassword();
    return metaSet('security', null).then(rewriteAll).then(function () {
      scheduleSave();
      emit();
      return true;
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
      return (snap.notes && snap.notes.length) ? put('notes', snap.notes) : null;
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
    readFile: readFile, adoptFile: adoptFile, relinkFile: relinkFile,
    fileIsSealed: fileIsSealed, onPasswordNeeded: onPasswordNeeded,
    installSnapshot: installSnapshot,
    openFile: openFile,
    hasStoredFile: hasStoredFile, storedFileName: storedFileName,
    scheduleSave: scheduleSave, flushNow: flushNow, isDirty: isDirty,
    status: status, onStatusChange: onStatusChange,
    supportsFileSystem: supportsFileSystem,
    unlock: unlock, lock: lock, isLocked: isLocked, isLoaded: isLoaded,
    wipeBrowser: wipeBrowser, dbName: dbName,
    setPassword: setPassword, clearPassword: clearPassword, loadData: loadData
  };
})(window);
