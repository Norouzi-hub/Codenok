/* چاپ: برگ پروندهٔ A4 و فهرست پرونده‌ها */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  // عرض مفید یک صفحهٔ A4 با حاشیه‌های تعریف‌شده، به پیکسل CSS
  var PRINT_WIDTH = 680;

  function area() {
    var node = document.getElementById('print-area');
    w.U.clear(node);
    return node;
  }

  function run(titleForTab) {
    var prev = document.title;
    document.title = titleForTab;
    document.body.classList.add('printing');
    var restore = function () {
      document.body.classList.remove('printing');
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1500);
  }

  function header(title, subtitle) {
    return el('div.p-header', null, [
      el('div.p-org', { text: w.Store.metaGet('orgName', '') ||
        M.state.settings.orgName || 'کمیتهٔ انضباطی' }),
      el('h1', { text: title }),
      subtitle ? el('div.p-sub', { text: subtitle }) : null,
      el('div.p-printed', { text: 'تاریخ چاپ: ' + J.stamp() })
    ]);
  }

  /** برگ کامل یک پرونده، گروه‌بندی‌شده، با تاریخچه */
  function printCase(rec) {
    var node = area();
    var name = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    node.appendChild(header('برگ پروندهٔ ' + w.U.toFaDigits(rec.caseNo || ''), name));

    w.GROUPS.forEach(function (g) {
      var fields = M.FIELDS.filter(function (f) {
        return f.group === g.key && rec[f.key];
      });
      if (!fields.length) return;
      var table = el('table.p-table');
      fields.forEach(function (f) {
        var v = f.type === 'date' ? J.format(rec[f.key]) : rec[f.key];
        table.appendChild(el('tr', null, [
          el('th', { text: w.UIForm.cleanLabel(f.label) }),
          el('td', { text: v })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: g.label }), table
      ]));
    });

    var items = M.timelineFor(rec);
    if (items.length) {
      var list = el('table.p-table.p-history', null, [
        el('tr', null, [
          el('th', { text: 'تاریخ' }), el('th', { text: 'رویداد' }), el('th', { text: 'شرح' })
        ])
      ]);
      items.forEach(function (it) {
        if (it.type === 'milestone') {
          list.appendChild(el('tr', null, [
            el('td', { text: J.format(it.date) }),
            el('td', { text: 'گردش‌کار' }),
            el('td', { text: it.label })
          ]));
        } else {
          var h = it.entry;
          var desc = (h.changes || []).map(function (c) {
            return w.UIForm.cleanLabel(c.label) + ': ' + (c.from || '—') + ' ← ' + (c.to || '—');
          }).join(' | ') || h.note || '';
          list.appendChild(el('tr', null, [
            el('td', { text: h.atJalali }),
            el('td', { text: w.UIForm.kindLabel(h.kind) + ' (' + (h.user || '') + ')' }),
            el('td', { text: desc })
          ]));
        }
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'تاریخچهٔ پرونده' }), list
      ]));
    }

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای کارشناس پرونده' }),
      el('div', { text: 'امضای دبیر کمیته' })
    ]));

    run('برگ پرونده ' + (rec.caseNo || ''));
  }

  /** فهرست پرونده‌ها با ستون‌های جاری */
  function printList(rows) {
    var node = area();
    node.appendChild(header('فهرست پرونده‌ها',
      w.U.toFaDigits(rows.length) + ' پرونده'));
    var fields = M.state.columns.map(function (k) { return M.FIELD_BY_KEY[k]; }).filter(Boolean);
    var table = el('table.p-table.p-list');
    var head = el('tr', null, [el('th', { text: 'ردیف' })]);
    fields.forEach(function (f) {
      head.appendChild(el('th', { text: w.UIForm.cleanLabel(f.label) }));
    });
    table.appendChild(head);
    rows.forEach(function (rec, i) {
      var tr = el('tr', null, [el('td', { text: w.U.toFaDigits(i + 1) })]);
      fields.forEach(function (f) {
        tr.appendChild(el('td', { text: w.UIList.cellText(rec, f) }));
      });
      table.appendChild(tr);
    });
    node.appendChild(table);
    run('فهرست پرونده‌ها');
  }

  /** گزارش مدیریتی: سنجه‌ها، یافته‌ها، و هر نمودار به همراه جدولش */
  function printReport(data, scopeText) {
    var node = area();
    node.appendChild(header('گزارش عملکرد کمیتهٔ انضباطی', scopeText));

    var k = data.kpis;
    var kpiTable = el('table.p-table.p-kpi');
    [
      ['کل پرونده‌های این برش', w.U.toFaDigits(k.total)],
      ['در جریان', w.U.toFaDigits(k.open)],
      ['مختومه‌شده', w.U.toFaDigits(k.closed) + ' (' + w.U.toFaDigits(k.closedPct) + '٪)'],
      ['میانهٔ روز از ورود تا طرح در کمیته',
        k.medianToCommittee == null ? '—' : w.U.toFaDigits(k.medianToCommittee) + ' روز'],
      ['میانگین روز تا طرح در کمیته',
        k.meanToCommittee == null ? '—' : w.U.toFaDigits(k.meanToCommittee) + ' روز'],
      ['قدیمی‌ترین پروندهٔ باز',
        k.oldestOpen ? w.U.toFaDigits(k.oldestOpen) + ' روز' : '—']
    ].forEach(function (r) {
      kpiTable.appendChild(el('tr', null, [
        el('th', { text: r[0] }), el('td', { text: r[1] })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'سنجه‌های کلیدی' }), kpiTable
    ]));

    // یافته‌ها — شدت همیشه با برچسب متنی می‌آید، نه فقط رنگ
    var fTable = el('table.p-table.p-list', null, [
      el('tr', null, [
        el('th', { text: 'شدت' }), el('th', { text: 'یافته' }),
        el('th', { text: 'تعداد' }), el('th', { text: 'پیشنهاد' })
      ])
    ]);
    data.findings.forEach(function (f) {
      var sev = (w.UIReport.SEV[f.severity] || {}).label || '';
      fTable.appendChild(el('tr', null, [
        el('td', { text: sev }),
        el('td', { text: f.title }),
        el('td', { text: f.count ? w.U.toFaDigits(f.count) : '—' }),
        el('td', { text: f.advice })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'یافته‌ها و پیشنهادها' }), fTable
    ]));

    // نمودارها: تصویر SVG از صفحه کپی می‌شود و جدول همزادش زیرش می‌آید
    var cards = w.U.$$('#main .chart-card:not(.findings)');
    cards.forEach(function (cardNode) {
      var title = (cardNode.querySelector('h3') || {}).textContent || '';
      var section = el('section.p-section', null, [el('h2', { text: title })]);
      var svg = cardNode.querySelector('svg.chart');
      if (svg) {
        // راهنما هم کپی می‌شود؛ روی کاغذ هویت سری نباید فقط با رنگ بماند
        var lg = cardNode.querySelector('.c-legend');
        if (lg) section.appendChild(lg.cloneNode(true));
        // viewBox روی صفحه به عرض کارت بسته است؛ برای کاغذ با عرض A4
        // دوباره رسم و سپس به حالت قبل برگردانده می‌شود، وگرنه چند برابر
        // بزرگ چاپ می‌شود.
        var onScreenWidth = svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0;
        if (svg.draw) svg.draw(PRINT_WIDTH);
        var clone = svg.cloneNode(true);
        if (svg.draw && onScreenWidth > 0) svg.draw(onScreenWidth);
        clone.removeAttribute('style');
        clone.setAttribute('width', '100%');
        section.appendChild(el('div.p-chart', null, [clone]));
      }
      var tbl = cardNode.querySelector('.c-table');
      if (!tbl && cardNode.repaint) {
        // کارت در حالت نمودار است؛ جدولش را موقتاً می‌سازیم
        var probe = cardNode.querySelector('.card-head .btn');
        if (probe) {
          probe.click();
          tbl = cardNode.querySelector('.c-table');
          if (tbl) tbl = tbl.cloneNode(true);
          probe.click();
        }
      } else if (tbl) {
        tbl = tbl.cloneNode(true);
      }
      if (tbl) {
        tbl.classList.add('p-table', 'p-list');
        section.appendChild(tbl);
      }
      node.appendChild(section);
    });

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای دبیر کمیته' }),
      el('div', { text: 'امضای رئیس کمیته' })
    ]));

    run('گزارش عملکرد کمیتهٔ انضباطی');
  }

  w.UIPrint = { printCase: printCase, printList: printList, printReport: printReport };
})(window);
