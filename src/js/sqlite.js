/*
 * ساخت فایل دیتابیس SQLite از روی داده‌ها (با sql.js که داخل همین فایل جاسازی شده).
 * موتور فقط هنگام اولین استفاده بارگذاری می‌شود تا باز شدن برنامه کند نشود.
 */
(function (w) {
  'use strict';

  var enginePromise = null;

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function engine() {
    if (enginePromise) return enginePromise;
    enginePromise = new Promise(function (resolve, reject) {
      var holder = document.getElementById('sqljs-wasm');
      if (typeof w.initSqlJs !== 'function' || !holder) {
        return reject(new Error('موتور SQLite در این نسخه جاسازی نشده است'));
      }
      var binary;
      try {
        binary = base64ToBytes(holder.textContent.replace(/\s+/g, ''));
      } catch (e) {
        return reject(new Error('خواندن موتور SQLite ناموفق بود'));
      }
      w.initSqlJs({ wasmBinary: binary }).then(resolve, reject);
    });
    return enginePromise;
  }

  function quoteIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

  /**
   * ساخت فایل .sqlite با دو جدول: cases (همهٔ فیلدها) و history (تاریخچه).
   * برمی‌گرداند: Promise<Blob>
   */
  function build(cases, history, fields) {
    return engine().then(function (SQL) {
      var db = new SQL.Database();
      var cols = ['id'].concat(fields.map(function (f) { return f.key; }));

      db.run('CREATE TABLE cases (' + cols.map(function (c) {
        return quoteIdent(c) + ' TEXT';
      }).join(', ') + ', PRIMARY KEY(id));');
      db.run('CREATE TABLE history (' +
        'id TEXT PRIMARY KEY, case_id TEXT, case_no TEXT, at TEXT, at_jalali TEXT, ' +
        'user TEXT, kind TEXT, field_key TEXT, field_label TEXT, old_value TEXT, ' +
        'new_value TEXT, note TEXT);');
      db.run('CREATE INDEX idx_cases_caseNo ON cases("caseNo");');
      db.run('CREATE INDEX idx_cases_nationalId ON cases("nationalId");');
      db.run('CREATE INDEX idx_history_case ON history(case_id, at);');

      var placeholders = cols.map(function () { return '?'; }).join(',');
      var insCase = db.prepare('INSERT INTO cases VALUES (' + placeholders + ')');
      cases.forEach(function (c) {
        insCase.run(cols.map(function (k) { return c[k] == null ? null : String(c[k]); }));
      });
      insCase.free();

      var insHist = db.prepare(
        'INSERT INTO history VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      history.forEach(function (h) {
        var rows = (h.changes && h.changes.length) ? h.changes : [{}];
        rows.forEach(function (ch, i) {
          insHist.run([
            h.id + (i ? '-' + i : ''), h.caseId, h.caseNo || '', h.at || '',
            h.atJalali || '', h.user || '', h.kind || '',
            ch.field || '', ch.label || '', ch.from == null ? null : String(ch.from),
            ch.to == null ? null : String(ch.to), h.note || ''
          ]);
        });
      });
      insHist.free();

      var bytes = db.export();
      db.close();
      return new Blob([bytes], { type: 'application/vnd.sqlite3' });
    });
  }

  function available() {
    return typeof w.initSqlJs === 'function' && !!document.getElementById('sqljs-wasm');
  }

  w.SQLiteOut = { build: build, available: available };
})(window);
