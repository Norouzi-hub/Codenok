/*
 * رمزنگاری داده‌ها با کلید برگرفته از رمز عبور کاربر.
 *
 * قفل صرفاً ظاهری روی یک فایل محلی امنیت نیست؛ هر کسی می‌تواند دیتابیس
 * مرورگر را باز کند. پس خودِ رکوردها رمز می‌شوند:
 *   PBKDF2-SHA256 (۳۱۰٬۰۰۰ دور) → کلید AES-GCM ۲۵۶ بیتی
 * رکوردهای پرونده، تاریخچه و فرادادهٔ مستندات رمز ذخیره می‌شوند.
 * تنظیمات و لیست‌های کشویی رمز نمی‌شوند (حساس نیستند و برای باز کردن قفل لازم‌اند).
 * فایل‌های پیوست روی دیسک رمز نمی‌شوند؛ آنها را سیستم‌عامل محافظت می‌کند.
 */
(function (w) {
  'use strict';

  var ITERATIONS = 310000;
  var subtle = (w.crypto && w.crypto.subtle) || null;

  var config = null;   // { salt, iterations, verifier }
  var key = null;      // CryptoKey پس از باز شدن قفل

  function available() { return !!subtle && !!w.TextEncoder; }

  function b64(buf) {
    var bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return w.btoa(out);
  }

  function unb64(str) {
    var bin = w.atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function randomBytes(n) {
    return w.crypto.getRandomValues(new Uint8Array(n));
  }

  function deriveKey(password, saltB64, iterations) {
    var enc = new TextEncoder();
    return subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey({
          name: 'PBKDF2', salt: unb64(saltB64),
          iterations: iterations || ITERATIONS, hash: 'SHA-256'
        }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function encryptWith(k, value) {
    var iv = randomBytes(12);
    var data = new TextEncoder().encode(JSON.stringify(value));
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, data).then(function (ct) {
      return { iv: b64(iv), ct: b64(ct) };
    });
  }

  function decryptWith(k, payload) {
    return subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, k, unb64(payload.ct))
      .then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf));
      });
  }

  // ------------------------------------------------------------------ وضعیت
  /** پیکربندی ذخیره‌شده را می‌گیرد (از انبار meta) */
  function configure(saved) {
    config = saved && saved.salt ? saved : null;
    key = null;
  }

  function isEnabled() { return !!config; }
  function isUnlocked() { return !!key || !config; }
  function needsPassword() { return !!config && !key; }

  /** تلاش برای باز کردن قفل؛ در صورت رمز نادرست false برمی‌گرداند */
  function unlock(password) {
    if (!config) return Promise.resolve(true);
    return deriveKey(password, config.salt, config.iterations)
      .then(function (k) {
        return decryptWith(k, config.verifier).then(function (probe) {
          if (probe !== 'parvandeha') throw new Error('mismatch');
          key = k;
          return true;
        });
      })
      .catch(function () { return false; });
  }

  function lock() { key = null; }

  /**
   * تعیین رمز تازه. پیکربندی جدید برمی‌گردد تا فراخوان ذخیره‌اش کند.
   * پس از این، داده‌های موجود باید دوباره نوشته شوند.
   */
  function setPassword(password) {
    if (!available()) {
      return Promise.reject(new Error('این مرورگر از رمزنگاری پشتیبانی نمی‌کند'));
    }
    var salt = b64(randomBytes(16));
    return deriveKey(password, salt, ITERATIONS).then(function (k) {
      return encryptWith(k, 'parvandeha').then(function (verifier) {
        config = { salt: salt, iterations: ITERATIONS, verifier: verifier };
        key = k;
        return config;
      });
    });
  }

  function clearPassword() {
    config = null;
    key = null;
  }

  // ------------------------------------------------------- رمزگذاری رکوردها
  /** رکورد را به پوستهٔ رمزشده تبدیل می‌کند؛ کلید اصلی بیرون می‌ماند */
  function sealRecord(record, keyField) {
    if (!key) return Promise.resolve(record);
    var out = {};
    out[keyField] = record[keyField];
    return encryptWith(key, record).then(function (enc) {
      out.__enc = enc;
      return out;
    });
  }

  function openRecord(record) {
    if (!record || !record.__enc) return Promise.resolve(record);
    if (!key) return Promise.reject(new Error('قفل است'));
    return decryptWith(key, record.__enc);
  }

  /** بستهٔ رمزشده برای فایل روی دیسک یا نسخهٔ پشتیبان */
  function sealSnapshot(snapshot) {
    if (!key || !config) return Promise.resolve(snapshot);
    return encryptWith(key, snapshot).then(function (enc) {
      return {
        app: 'parvandeha', encrypted: true,
        kdf: { salt: config.salt, iterations: config.iterations },
        verifier: config.verifier,
        iv: enc.iv, data: enc.ct
      };
    });
  }

  /** باز کردن بستهٔ رمزشده با رمزی که کاربر می‌دهد */
  function openSnapshot(payload, password) {
    if (!payload || !payload.encrypted) return Promise.resolve(payload);
    return deriveKey(password, payload.kdf.salt, payload.kdf.iterations)
      .then(function (k) {
        return decryptWith(k, { iv: payload.iv, ct: payload.data });
      });
  }

  w.Vault = {
    available: available, configure: configure, isEnabled: isEnabled,
    isUnlocked: isUnlocked, needsPassword: needsPassword,
    unlock: unlock, lock: lock, setPassword: setPassword,
    clearPassword: clearPassword, sealRecord: sealRecord, openRecord: openRecord,
    sealSnapshot: sealSnapshot, openSnapshot: openSnapshot,
    getConfig: function () { return config; }
  };
})(window);
