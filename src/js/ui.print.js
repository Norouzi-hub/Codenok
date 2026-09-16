/* چاپ: برگ پروندهٔ A4 و فهرست پرونده‌ها */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

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

  w.UIPrint = { printCase: printCase, printList: printList };
})(window);
