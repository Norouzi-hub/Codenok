/*
 * نمایشگر سند — پنجرهٔ بزرگ‌نمایی.
 *
 * تا امروز، کلیک روی یک سند آن را در برگهٔ تازهٔ مرورگر باز می‌کرد: کاربر از
 * برنامه بیرون می‌افتاد و برای دیدن سند بعدی باید برمی‌گشت. حالا سند همین‌جا
 * باز می‌شود، با فلش می‌شود بین اسناد پرونده جابه‌جا شد، و هر وقت خواست
 * دانلودش کند دکمه‌اش همان‌جاست.
 *
 * تصویر و PDF واقعاً نمایش داده می‌شوند. ورد و اکسل و زیپ را هیچ مرورگری
 * نشان نمی‌دهد، پس به‌جای صفحهٔ خالی، صریح گفته می‌شود و دکمهٔ دانلود بزرگ
 * می‌شود — همان کاری که کاربر می‌خواهد بکند.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, D = w.Docs;

  var IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'];

  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }
  function isImage(doc) {
    return (doc.mime || '').indexOf('image/') === 0 ||
      IMAGE_EXT.indexOf(extOf(doc.fileName)) >= 0;
  }
  function isPdf(doc) {
    return (doc.mime || '') === 'application/pdf' || extOf(doc.fileName) === 'pdf';
  }
  function fa(n) { return w.U.toFaDigits(n); }

  function sizeText(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return fa(bytes) + ' بایت';
    if (bytes < 1048576) return fa(Math.round(bytes / 1024)) + ' کیلوبایت';
    return fa((bytes / 1048576).toFixed(1)) + ' مگابایت';
  }

  /**
   * باز کردن نمایشگر.
   * list: اسناد قابل مرور (برای فلش چپ/راست) · start: شمارهٔ سند فعلی
   */
  function open(list, start) {
    list = (list || []).filter(Boolean);
    if (!list.length) return null;
    var i = Math.max(0, Math.min(start || 0, list.length - 1));
    var urls = [];
    var closed = false;

    var stage = el('div.vw-stage');
    var titleNode = el('div.vw-title');
    var metaNode = el('div.vw-meta');
    var bodyNode = el('div.vw-letter');
    var counter = el('span.vw-count');

    function release() {
      urls.forEach(function (u) { URL.revokeObjectURL(u); });
      urls = [];
    }

    function close() {
      if (closed) return;
      closed = true;
      release();
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('closing');
      setTimeout(function () { overlay.remove(); }, 160);
    }

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      // در چیدمان راست‌به‌چپ، فلش راست یعنی «قبلی»
      if (e.key === 'ArrowRight') { go(-1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(1); e.preventDefault(); }
    }

    function go(step) {
      if (list.length < 2) return;
      i = (i + step + list.length) % list.length;
      show();
    }

    /** دانلود همان فایل، با نام خودش */
    function save() {
      var doc = list[i];
      D.readFile(doc).then(function (file) {
        w.U.download(doc.fileName, file);
      }).catch(function (err) {
        w.U.toast('فایل پیدا نشد: ' + err.message, 'bad');
      });
    }

    function openOutside() {
      D.openDoc(list[i]).catch(function (e) { w.U.toast(e.message, 'bad'); });
    }

    function show() {
      var doc = list[i];
      release();
      w.U.clear(stage);
      stage.classList.remove('vw-fit');

      titleNode.textContent = doc.title || doc.letterNo || doc.originalName ||
        doc.fileName;
      w.U.clear(metaNode);
      [
        doc.kind,
        D.directionLabel(doc.direction),
        doc.letterNo ? 'شمارهٔ ' + w.U.toFaDigits(doc.letterNo) : '',
        doc.docDate ? J.format(doc.docDate) : '',
        sizeText(doc.size)
      ].filter(Boolean).forEach(function (t) {
        metaNode.appendChild(el('span.vw-chip', { text: t }));
      });
      counter.textContent = list.length > 1
        ? fa(i + 1) + ' از ' + fa(list.length) : '';

      w.U.clear(bodyNode);
      if (doc.body) {
        bodyNode.appendChild(el('div.vw-letter-head', { text: 'متن نامه' }));
        bodyNode.appendChild(el('p', { text: doc.body }));
      }

      stage.appendChild(el('div.vw-loading', { text: 'در حال باز کردن…' }));

      D.readFile(doc).then(function (file) {
        if (closed || list[i] !== doc) return;
        var blob = (doc.mime && file.type !== doc.mime)
          ? new Blob([file], { type: doc.mime }) : file;
        var url = URL.createObjectURL(blob);
        urls.push(url);
        w.U.clear(stage);

        if (isImage(doc)) {
          var img = el('img.vw-img', { src: url, alt: doc.kind });
          // کلیک روی تصویر: بین «جا شدن در صفحه» و «اندازهٔ واقعی»
          img.addEventListener('click', function () {
            stage.classList.toggle('vw-fit');
          });
          img.title = 'برای بزرگ‌نمایی کلیک کنید';
          stage.appendChild(img);
          return;
        }
        if (isPdf(doc)) {
          stage.appendChild(el('iframe.vw-pdf', { src: url, title: doc.fileName }));
          return;
        }
        // ورد، اکسل، زیپ… — مرورگر نمایششان نمی‌دهد
        stage.appendChild(el('div.vw-none', null, [
          el('span.vw-none-icon', {
            html: w.Mobile.icon(isZip(doc) ? 'fileZip' : 'fileText')
          }),
          el('p', { text: 'این نوع فایل در مرورگر نمایش داده نمی‌شود.' }),
          el('p.muted.tiny', { text: doc.fileName }),
          el('button.btn.primary', {
            type: 'button', text: 'دانلود فایل', onclick: save
          })
        ]));
      }).catch(function (err) {
        if (closed) return;
        w.U.clear(stage);
        stage.appendChild(el('div.vw-none', null, [
          el('p', { text: 'فایل در پوشه پیدا نشد.' }),
          el('p.muted.tiny', { text: doc.fileName })
        ]));
      });
    }

    function isZip(doc) {
      return ['zip', 'rar', '7z'].indexOf(extOf(doc.fileName)) >= 0;
    }

    var prevBtn = el('button.vw-nav.vw-prev', {
      type: 'button', title: 'سند قبلی', html: w.Mobile.icon('chevronRight'),
      onclick: function () { go(-1); }
    });
    var nextBtn = el('button.vw-nav.vw-next', {
      type: 'button', title: 'سند بعدی', html: w.Mobile.icon('chevronLeft'),
      onclick: function () { go(1); }
    });
    if (list.length < 2) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }

    var box = el('div.vw-box', null, [
      el('div.vw-head', null, [
        el('div.vw-head-text', null, [titleNode, metaNode]),
        counter,
        el('button.icon-btn', {
          type: 'button', title: 'بستن', text: '✕', onclick: close
        })
      ]),
      el('div.vw-main', null, [prevBtn, stage, nextBtn]),
      bodyNode,
      el('div.vw-foot', null, [
        el('button.btn.primary', {
          type: 'button', text: 'دانلود', onclick: save
        }),
        el('button.btn.ghost', {
          type: 'button', text: 'باز کردن در برگهٔ تازه', onclick: openOutside
        }),
        el('div.spacer'),
        el('button.btn.ghost', { type: 'button', text: 'بستن', onclick: close })
      ])
    ]);

    var overlay = el('div.overlay.vw-overlay', null, [box]);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    show();
    return { close: close, root: box };
  }

  w.UIViewer = { open: open };
})(window);
