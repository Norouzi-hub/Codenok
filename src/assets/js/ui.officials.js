/*
 * دفتر مقامات — رابط.
 *
 *   dialog(app, onDone)  — فهرستِ افراد: ویرایش، افزودن، حذف، ورود و خروجیِ اکسل،
 *                          و آخرین تغییرها («شهردار منطقه ۵: الف ← ب»).
 *   importFile(onDone)   — اکسلِ تازه: نگاشتِ ستون‌ها (خودکار، قابل اصلاح)،
 *                          پیش‌نمایشِ نامه‌ها، و فرقش با دفترِ فعلی پیش از جایگزینی.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, O = w.Officials;
  function fa(n) { return w.U.toFaDigits(n); }
  var RANKS = [['high', 'بالادست — «خواهشمند است»'], ['peer', 'همتراز — «شایسته است»'], ['low', 'پایین‌دست — «مقتضی است»']];

  function pickFile(accept) {
    return new Promise(function (resolve) {
      var input = el('input', { type: 'file', accept: accept });
      input.style.display = 'none';
      input.addEventListener('change', function () { resolve(input.files && input.files[0]); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  function select(options, value, onChange) {
    var s = el('select.input.small');
    options.forEach(function (o) { s.appendChild(el('option', { value: o[0], text: o[1] })); });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  /* --------------------------------------------------- ورود از اکسل */
  function importFile(onDone) {
    return pickFile('.xlsx').then(function (file) {
      if (!file) return null;
      return file.arrayBuffer().then(w.XLSX.read).then(function (rows) {
        rows = rows.filter(function (r) { return r && r.some(function (c) { return String(c || '').trim(); }); });
        if (!rows.length) throw new Error('فایل داده‌ای ندارد');
        return preview(rows, file.name, onDone);
      });
    }).catch(function (e) {
      w.U.toast('خواندنِ اکسل ناموفق بود: ' + e.message, 'bad');
    });
  }

  function preview(rows, fileName, onDone) {
    var det = O.detect(rows);
    var header = det.header >= 0 ? det.header : 0;
    var map = Object.assign({}, det.map);
    var keepMissing = false;
    var width = rows.reduce(function (n, r) { return Math.max(n, r.length); }, 0);
    var colOpts = [['', '—']];
    for (var i = 0; i < width; i++) {
      var h = String((rows[header] || [])[i] || '').trim();
      colOpts.push([String(i), w.XLSX.colName(i) + (h ? ' — ' + h : '')]);
    }

    var mapBox = el('div.of-map');
    var out = el('div.of-preview');
    var parsed = [];

    function draw() {
      w.U.clear(mapBox);
      O.COLS.forEach(function (c) {
        if (c.k === 'first' || c.k === 'last') {
          if (map.name != null && map.first == null && map.last == null) return;
        }
        mapBox.appendChild(el('label.field', null, [
          el('span.field-label', { text: c.label }),
          select(colOpts, map[c.k] == null ? '' : String(map[c.k]), function (v) {
            if (v === '') delete map[c.k]; else map[c.k] = +v;
            draw();
          })
        ]));
      });
      parsed = O.parse(rows, header, map);
      var d = O.diff(parsed);
      w.U.clear(out);
      if (!parsed.length) {
        out.appendChild(el('p.warn', { text: 'هیچ سطری خوانده نشد — ستونِ «سمت» (یا «واحد») را مشخص کنید.' }));
        return;
      }
      out.appendChild(el('p.of-sum', null, [
        el('b', { text: fa(parsed.length) + ' نفر خوانده شد. ' }),
        el('span', { text: O.list().length
          ? [d.added.length ? fa(d.added.length) + ' تازه' : '', d.changed.length ? fa(d.changed.length) + ' عوض‌شده' : '',
            d.removed.length ? fa(d.removed.length) + ' در فایل نیست' : '', d.same ? fa(d.same) + ' بی‌تغییر' : '']
            .filter(Boolean).join(' · ')
          : 'دفتر الان خالی است.' })
      ]));
      if (d.changed.length) {
        out.appendChild(el('div.of-changes', null, [el('b', { text: 'عوض‌شده‌ها' })].concat(d.changed.slice(0, 40).map(function (c) {
          return el('div.of-change', null, [
            el('span.of-ch-title', { text: O.titleOf(c.to) }),
            el('s', { text: c.from.name || '—' }), el('span', { text: ' ← ' }), el('b', { text: c.to.name || '—' })
          ]);
        }))));
      }
      if (d.removed.length) {
        out.appendChild(el('label.act-check', null, [
          (function () {
            var b = el('input', { type: 'checkbox' });
            b.checked = keepMissing;
            b.addEventListener('change', function () { keepMissing = b.checked; });
            return b;
          })(),
          el('span', { text: fa(d.removed.length) + ' نفرِ فعلیِ دفتر در این فایل نیستند (' +
            d.removed.slice(0, 3).map(O.titleOf).join('، ') + (d.removed.length > 3 ? '، …' : '') +
            '). نگهشان دار — وگرنه حذف می‌شوند.' })
        ]));
      }
      out.appendChild(el('b.of-sample-h', { text: 'نمونهٔ سطرِ گیرنده در نامه:' }));
      out.appendChild(el('ol.of-sample', null, parsed.slice(0, 8).map(function (o) {
        return el('li', { text: O.address(o) });
      })));
    }
    draw();

    var m = w.U.modal('ورودِ دفتر مقامات از اکسل', el('div.of-import', null, [
      el('p.muted.tiny', {
        text: 'ستون‌ها از روی سرستون شناخته شدند؛ اگر جایی درست نیست، همین‌جا عوضش کنید. ' +
          'اگر سمت و واحد در یک ستون‌اند («شهردار منطقه ۵»)، فقط «سمت» را بدهید. ' +
          '«آقا/خانم» اگر جلوی نام باشد خوانده می‌شود.'
      }),
      mapBox, out
    ]), [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      el('button.btn.primary', {
        type: 'button', text: 'جایگزینیِ دفتر',
        onclick: function () {
          if (!parsed.length) { w.U.toast('سطری برای ورود نیست.', 'warn'); return; }
          O.replace(parsed, { source: fileName, keepMissing: keepMissing }).then(function (d) {
            m.close();
            w.U.toast('دفتر مقامات به‌روز شد: ' + fa(O.list().length) + ' نفر' +
              (d.changed.length ? '، ' + fa(d.changed.length) + ' تغییرِ نام' : '') + '.', 'good');
            if (onDone) onDone();
          });
        }
      })
    ]);
    m.root.classList.add('of-modal');
    return m;
  }

  /* --------------------------------------------------- پنجرهٔ دفتر */
  function dialog(app, onDone) {
    var work = O.list().map(function (o) { return Object.assign({}, o); });
    var q = '';
    var dirty = false;
    var info = el('p.of-info');
    var table = el('div.of-list');
    var logBox = el('div.of-log');

    function drawInfo() {
      var d = O.data(), age = O.age();
      info.textContent = work.length
        ? fa(work.length) + ' نفر' + (d.updatedAt ? ' · به‌روزرسانی: ' + J.format(d.updatedAt) +
          (age != null && age > 0 ? ' (' + fa(age) + ' روز پیش)' : '') : '') + (d.source ? ' · از «' + d.source + '»' : '')
        : 'دفتر خالی است. فهرستِ اکسلِ شهرداران و مدیران را وارد کنید — ستون‌های «نام و نام خانوادگی»، ' +
          '«سمت» و «واحد/منطقه/سازمان» (یا سمت و واحد در یک ستون).';
    }

    function drawLog() {
      w.U.clear(logBox);
      var log = (O.data().log || []).slice().reverse().filter(function (l) { return l.changed && l.changed.length; });
      if (!log.length) return;
      logBox.appendChild(el('b', { text: 'آخرین جابه‌جایی‌ها' }));
      log.slice(0, 3).forEach(function (l) {
        l.changed.slice(0, 6).forEach(function (c) {
          logBox.appendChild(el('div.of-change', null, [
            el('span.muted.tiny', { text: J.format(l.at) }),
            el('span.of-ch-title', { text: c.title }),
            el('s', { text: c.from || '—' }), el('span', { text: ' ← ' }), el('b', { text: c.to || '—' })
          ]));
        });
      });
    }

    function drawList() {
      w.U.clear(table);
      var nq = q.replace(/\s+/g, '');
      var shown = work.filter(function (o) {
        return !nq || (o.name + o.position + (o.title || '') + o.org).replace(/\s+/g, '').indexOf(nq) >= 0;
      });
      shown.forEach(function (o) {
        var prev = el('div.of-addr', { text: O.address(o) });
        function upd(k) {
          return function (v) { o[k] = v; if (k === 'rank') o.rankManual = true; dirty = true; prev.textContent = O.address(o); };
        }
        function input(k, ph, value) {
          var x = el('input.input.small', { type: 'text', value: value != null ? value : (o[k] || ''), placeholder: ph });
          x.addEventListener('input', function () { upd(k)(x.value); });
          return x;
        }
        table.appendChild(el('div.of-row', null, [
          select(O.HONORS.map(function (h) { return [h, h]; }), o.honor || O.HONORS[0], upd('honor')),
          input('name', 'نام و نام خانوادگی'),
          // عنوانِ کامل، همان‌طور که در نامه می‌آید
          input('title', 'شهردار محترم منطقه ۵', O.titleOf(o)),
          input('org', 'نام واحد: منطقه ۵، شرکت …'),
          select(RANKS, o.rank || 'peer', upd('rank')),
          el('button.btn.small.ghost.danger', {
            type: 'button', text: '✕', title: 'حذف',
            onclick: function () { work.splice(work.indexOf(o), 1); dirty = true; drawList(); drawInfo(); }
          }),
          prev
        ]));
      });
      if (!shown.length && work.length) table.appendChild(el('p.muted', { text: 'چیزی پیدا نشد.' }));
    }

    var search = el('input.input.small', { type: 'search', placeholder: 'جست‌وجو: نام، سمت یا منطقه' });
    search.addEventListener('input', function () { q = search.value; drawList(); });

    function reloadFromStore() {
      work = O.list().map(function (o) { return Object.assign({}, o); });
      dirty = false;
      drawInfo(); drawList(); drawLog();
    }

    drawInfo(); drawList(); drawLog();

    var m = w.U.modal('دفتر مقامات', el('div.of-dialog', null, [
      el('p.muted.tiny', {
        text: 'مینوت نامه نامِ مخاطب را از اینجا برمی‌دارد: «جناب آقای … شهردار محترم منطقه ۵». ' +
          'وقتی کسی عوض شد، فهرستِ تازه را دوباره وارد کنید یا همین‌جا نامش را عوض کنید.'
      }),
      info,
      el('div.btn-row', null, [
        el('button.btn.small.primary', {
          type: 'button', text: 'ورود از اکسل',
          onclick: function () {
            var go = function () { importFile(function () { reloadFromStore(); if (onDone) onDone(); }); };
            if (!dirty) { go(); return; }
            w.U.confirmBox('تغییرهای ذخیره‌نشده', 'ویرایش‌های همین پنجره با ورودِ فایل کنار گذاشته می‌شوند.', 'ادامه')
              .then(function (ok) { if (ok) go(); });
          }
        }),
        el('button.btn.small', {
          type: 'button', text: 'خروجی اکسل', title: 'برای ویرایش در اکسل و ورودِ دوباره',
          disabled: !O.list().length,
          onclick: function () {
            w.U.download('daftar-maghamat-' + J.today() + '.xlsx',
              w.XLSX.build([{ name: 'مقامات', rows: O.rows(), widths: [12, 26, 26, 30, 12] }]));
          }
        }),
        el('button.btn.small.ghost', {
          type: 'button', text: '＋ افزودن',
          onclick: function () {
            work.unshift({ id: w.U.uid(), honor: O.HONORS[0], name: '', position: '', title: '', org: '', rank: 'peer' });
            dirty = true; q = ''; search.value = '';
            drawList(); drawInfo();
            var first = table.querySelector('.of-row input');
            if (first) first.focus();
          }
        }),
        el('span.spacer'),
        search
      ]),
      table,
      logBox
    ]), [
      el('button.btn.ghost', { type: 'button', text: 'بستن', onclick: function () { m.close(); } }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیره',
        onclick: function () {
          var clean = work.filter(function (o) { return o.title || o.position || o.org; });
          O.setList(clean).then(function () {
            dirty = false;
            m.close();
            w.U.toast('دفتر مقامات ذخیره شد: ' + fa(clean.length) + ' نفر.', 'good');
            if (onDone) onDone();
          });
        }
      })
    ]);
    m.root.classList.add('of-modal');
    return m;
  }

  w.UIOfficials = { dialog: dialog, importFile: importFile, preview: preview };
})(window);
