/* ابزارهای عمومی */
(function (w) {
  'use strict';

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /** ارقام فارسی/عربی را به لاتین تبدیل می‌کند. */
  function toLatinDigits(s) {
    if (!s) return '';
    return String(s).replace(/[۰-۹٠-٩]/g, function (ch) {
      var i = FA_DIGITS.indexOf(ch);
      return String(i < 0 ? AR_DIGITS.indexOf(ch) : i);
    });
  }

  /** ارقام لاتین را برای نمایش به فارسی تبدیل می‌کند. */
  function toFaDigits(s) {
    return String(s == null ? '' : s).replace(/[0-9]/g, function (d) {
      return FA_DIGITS[+d];
    });
  }

  /**
   * متن را برای جستجو یکدست می‌کند: ی/ک عربی، همزه‌ها، نیم‌فاصله،
   * اعراب، ارقام و فاصله‌های اضافه.
   */
  function normalize(s) {
    if (!s) return '';
    return toLatinDigits(s)
      .replace(/[يى]/g, 'ی')            // ي ى -> ی
      .replace(/ك/g, 'ک')                    // ك -> ک
      .replace(/[آأإٱ]/g, 'ا')// آ أ إ -> ا
      .replace(/ة/g, 'ه')                    // ة -> ه
      .replace(/[ً-ْٰـ]/g, '')     // اعراب و کشیدگی
      .replace(/[​-‏‪-‮]/g, ' ')   // نویسه‌های کنترلی و نیم‌فاصله
      .replace(/[^\w؀-ۿ]+/g, ' ')            // نشانه‌گذاری -> فاصله
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /** el('div.card', {title: 'x'}, [child, 'text']) */
  function el(spec, attrs, children) {
    var parts = String(spec).split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) {
      if (parts[i][0] === '.') node.classList.add(parts[i].slice(1));
      else node.id = parts[i].slice(1);
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else if (k === 'value') node.value = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var toastTimer;
  function toast(msg, kind) {
    var box = $('#toast');
    box.textContent = msg;
    box.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 3800);
  }

  /** پنجرهٔ ماژولار ساده. برمی‌گرداند: {root, close} */
  function modal(title, bodyNode, footerNodes) {
    var overlay = el('div.overlay');
    var close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var box = el('div.modal', null, [
      el('div.modal-head', null, [
        el('h3', { text: title }),
        el('button.icon-btn', { type: 'button', title: 'بستن', onclick: close, text: '✕' })
      ]),
      el('div.modal-body', null, [bodyNode]),
      el('div.modal-foot', null, footerNodes || [])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    return { root: box, close: close };
  }

  function confirmBox(title, message, okLabel) {
    return new Promise(function (resolve) {
      var m;
      var ok = el('button.btn.danger', {
        type: 'button', text: okLabel || 'تأیید',
        onclick: function () { m.close(); resolve(true); }
      });
      var cancel = el('button.btn', {
        type: 'button', text: 'انصراف',
        onclick: function () { m.close(); resolve(false); }
      });
      m = modal(title, el('p', { text: message }), [cancel, ok]);
      ok.focus();
    });
  }

  /* روی  file://  کروم نام غیرلاتین را از  a[download]  نمی‌پذیرد: مبدأ
     opaque است و فایل «download» ذخیره می‌شود — بی‌پسوند، یعنی ورد و اکسل
     هم بازش نمی‌کنند. راه‌حلی برای نگه‌داشتن نام فارسی نیست، پس دست‌کم
     پسوند را نجات می‌دهیم تا فایل با برنامهٔ درست باز شود. نام‌هایی که خودِ
     برنامه می‌سازد (فرم‌ها، اکسل، پشتیبان) از اول لاتین‌اند. */
  function safeName(filename) {
    var name = String(filename || '').replace(/[\\/:*?"<>|]/g, '-');
    if (!/[^\x20-\x7E]/.test(name)) return name;
    var dot = name.lastIndexOf('.');
    var ext = dot > 0 ? name.slice(dot) : '';
    var base = (dot > 0 ? name.slice(0, dot) : name)
      .replace(/[^\x20-\x7E]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/[^\x20-\x7E]/.test(ext)) ext = '';   // پسوند فارسی به کار نمی‌آید
    return (base || 'file-' + Date.now().toString(36)) + ext;
  }

  function download(filename, blob) {
    var name = safeName(filename);
    /* اگر خودِ Blob یک File با نام باشد، کروم همان نام را می‌گذارد؛
       این‌طور روی  file://  هم نام از دست نمی‌رود. */
    var named = blob;
    try {
      if (typeof File === 'function' && !(blob instanceof File)) {
        named = new File([blob], name,
          { type: blob.type || 'application/octet-stream' });
      }
    } catch (e) { named = blob; }
    var url = URL.createObjectURL(named);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  w.U = {
    toLatinDigits: toLatinDigits, toFaDigits: toFaDigits, normalize: normalize,
    debounce: debounce, el: el, $: $, $$: $$, clear: clear, toast: toast,
    modal: modal, confirmBox: confirmBox, download: download,
    safeName: safeName, uid: uid
  };
})(window);
