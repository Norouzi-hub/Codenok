/*
 * پوشهٔ ساختگیِ درون‌حافظه‌ای، به‌جای showDirectoryPicker.
 *
 * دسترسی واقعی به پوشه را نمی‌شود خودکار کرد (مرورگر تأیید دستی می‌خواهد)،
 * پس یک FileSystemDirectoryHandle ساختگی تزریق می‌کنیم و کل منطق مستندات
 * روی همان آزموده می‌شود. چند تست از این استفاده می‌کنند، پس یک جا نوشته
 * شده تا دو نسخه از هم دور نیفتند.
 */
module.exports = `
(function () {
  function makeFile(name) {
    var blob = new Blob([]);
    return {
      kind: 'file', name: name,
      getFile: function () {
        return Promise.resolve(new File([blob], name, { type: blob.type }));
      },
      createWritable: function () {
        var parts = [];
        return Promise.resolve({
          write: function (d) { parts.push(d); return Promise.resolve(); },
          close: function () { blob = new Blob(parts); return Promise.resolve(); }
        });
      }
    };
  }
  function notFound(n) {
    var e = new Error('NotFound: ' + n);
    e.name = 'NotFoundError';
    return e;
  }
  function makeDir(name) {
    var entries = new Map();
    return {
      kind: 'directory', name: name, _entries: entries,
      queryPermission: function () { return Promise.resolve('granted'); },
      requestPermission: function () { return Promise.resolve('granted'); },
      getDirectoryHandle: function (n, opts) {
        if (!entries.has(n)) {
          if (!opts || !opts.create) return Promise.reject(notFound(n));
          entries.set(n, makeDir(n));
        }
        return Promise.resolve(entries.get(n));
      },
      getFileHandle: function (n, opts) {
        if (!entries.has(n)) {
          if (!opts || !opts.create) return Promise.reject(notFound(n));
          entries.set(n, makeFile(n));
        }
        return Promise.resolve(entries.get(n));
      },
      removeEntry: function (n) {
        if (!entries.has(n)) return Promise.reject(notFound(n));
        entries.delete(n);
        return Promise.resolve();
      },
      values: function () {
        var arr = Array.from(entries.values()), i = 0;
        return {
          next: function () {
            return Promise.resolve(i < arr.length
              ? { done: false, value: arr[i++] } : { done: true });
          }
        };
      }
    };
  }

  window.__mockRoot = makeDir('مستندات کمیته');
  window.showDirectoryPicker = function () { return Promise.resolve(window.__mockRoot); };

  // handle ساختگی قابل ذخیره در IndexedDB نیست (تابع دارد)؛ برای همین کلید
  // یک حافظهٔ جداگانه می‌گذاریم تا مسیر «ذخیره و بازخوانی ارجاع» هم آزموده شود
  var fakeMeta = {};
  var origMetaSet = window.Store.metaSet;
  var origMetaGet = window.Store.metaGet;
  window.Store.metaSet = function (k, v) {
    if (k === 'docsFolder') { fakeMeta[k] = v; return Promise.resolve(); }
    return origMetaSet(k, v);
  };
  window.Store.metaGet = function (k, d) {
    if (k === 'docsFolder' && Object.prototype.hasOwnProperty.call(fakeMeta, k)) {
      return fakeMeta[k];
    }
    return origMetaGet(k, d);
  };

  // درخت پوشه به شکل ساده، برای بازرسی از تست
  window.__tree = function (dir) {
    dir = dir || window.__mockRoot;
    var out = {};
    dir._entries.forEach(function (h, n) {
      out[n] = h.kind === 'directory' ? window.__tree(h) : 'file';
    });
    return out;
  };
})();
`;
