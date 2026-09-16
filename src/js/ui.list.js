/* نمای فهرست: جستجو، فیلترها و جدول با رندر مجازی */
(function (w) {
  'use strict';

  var el = w.U.el, $ = w.U.$, J = w.J, M = w.Model;
  var ROW_H = 38;
  var OVERSCAN = 8;

  var FILTER_FIELDS = [
    { key: 'status', label: 'وضعیت پرونده' },
    { key: 'expert', label: 'کارشناس' },
    { key: 'year', label: 'سال رسیدگی' },
    { key: 'caseType', label: 'نوع پرونده' },
    { key: 'orgUnit', label: 'واحد سازمانی' },
    { key: 'reporterOrg', label: 'مرجع گزارش‌دهنده' }
  ];

  function colWidth(field) {
    if (!field) return 150;
    if (field.key === 'caseNo') return 110;
    if (field.type === 'date') return 120;
    if (field.type === 'textarea') return 260;
    if (field.type === 'select') return 170;
    return 150;
  }

  function cellText(rec, field) {
    var v = rec[field.key] || '';
    if (!v) return '';
    if (field.type === 'date') return J.format(v);
    return String(v);
  }

  function statusClass(status) {
    if (!status) return '';
    if (status.indexOf('مختومه') >= 0) return 'st-done';
    if (status.indexOf('انتظار') >= 0) return 'st-wait';
    if (status.indexOf('مفتوح') >= 0) return 'st-open';
    if (status.indexOf('دستور کار') >= 0) return 'st-queued';
    if (status.indexOf('رای') >= 0 || status.indexOf('رأی') >= 0) return 'st-verdict';
    return '';
  }

  // ------------------------------------------------------------------ فیلترها
  function renderFilters(app) {
    var box = el('div.filters');
    box.appendChild(el('h3', { text: 'فیلترها' }));

    FILTER_FIELDS.forEach(function (ff) {
      var values = M.distinct(ff.key);
      if (!values.length) return;
      var selected = app.state.filters[ff.key] || [];
      var details = el('details.filter-group', { open: selected.length > 0 });
      details.appendChild(el('summary', null, [
        el('span', { text: ff.label }),
        selected.length ? el('span.badge', { text: w.U.toFaDigits(selected.length) }) : null
      ]));
      var list = el('div.filter-options');
      values.forEach(function (v) {
        var count = M.state.cases.filter(function (c) { return (c[ff.key] || '') === v; }).length;
        var id = 'f-' + ff.key + '-' + w.U.normalize(v).replace(/\s/g, '-');
        var cb = el('input', {
          type: 'checkbox', id: id, checked: selected.indexOf(v) >= 0,
          onchange: function () {
            var cur = (app.state.filters[ff.key] || []).slice();
            if (this.checked) cur.push(v);
            else cur = cur.filter(function (x) { return x !== v; });
            if (cur.length) app.state.filters[ff.key] = cur;
            else delete app.state.filters[ff.key];
            app.refresh();
          }
        });
        list.appendChild(el('label.filter-option', null, [
          cb, el('span.fo-label', { text: v }), el('span.fo-count', { text: w.U.toFaDigits(count) })
        ]));
      });
      details.appendChild(list);
      box.appendChild(details);
    });

    // بازهٔ تاریخ، روی فیلد تاریخ انتخابی
    var range = el('div.filter-group.range');
    range.appendChild(el('h4', { text: 'بازهٔ زمانی' }));
    var baseSel = el('select.input.small');
    w.Report.DATE_BASES.forEach(function (b) {
      baseSel.appendChild(el('option', {
        value: b.key, text: b.label,
        selected: b.key === (app.state.filters._dateField || 'intakeDate')
      }));
    });
    baseSel.value = app.state.filters._dateField || 'intakeDate';
    baseSel.addEventListener('change', function () {
      app.state.filters._dateField = baseSel.value;
      app.refresh();
    });
    range.appendChild(el('label.mini', { text: 'بر پایهٔ' }));
    range.appendChild(baseSel);
    var from = w.DatePicker.field(app.state.filters._from || '', function (v) {
      if (v) app.state.filters._from = v; else delete app.state.filters._from;
      app.refresh();
    });
    var to = w.DatePicker.field(app.state.filters._to || '', function (v) {
      if (v) app.state.filters._to = v; else delete app.state.filters._to;
      app.refresh();
    });
    range.appendChild(el('label.mini', { text: 'از تاریخ' }));
    range.appendChild(from);
    range.appendChild(el('label.mini', { text: 'تا تاریخ' }));
    range.appendChild(to);
    box.appendChild(range);

    box.appendChild(el('button.btn.ghost.block', {
      type: 'button', text: 'پاک کردن همهٔ فیلترها',
      onclick: function () {
        app.state.filters = {};
        app.state.q = '';
        app.state.filterNote = '';
        app.refresh(true);
      }
    }));
    return box;
  }

  // ---------------------------------------------------------- جدول مجازی‌ساز
  function buildTable(app, rows) {
    var fields = M.state.columns.map(function (k) { return M.FIELD_BY_KEY[k]; })
      .filter(Boolean);
    // ستون ثابت گردش‌کار، پیش از ستون‌های انتخابی کاربر
    var template = '38px 104px ' + fields.map(function (f) {
      return colWidth(f) + 'px';
    }).join(' ');

    var header = el('div.trow.thead');
    header.style.gridTemplateColumns = template;

    // انتخاب همهٔ نتیجهٔ جاری، برای اقدام دسته‌ای
    var allBox = el('input', {
      type: 'checkbox', title: 'انتخاب همهٔ نتیجهٔ این جستجو',
      checked: rows.length > 0 && rows.every(function (r) {
        return app.state.selected[r.id];
      })
    });
    allBox.addEventListener('change', function () {
      rows.forEach(function (r) { app.toggleSelect(r.id, allBox.checked); });
      app.render();
    });
    header.appendChild(el('div.th.th-pick', null, [allBox]));
    header.appendChild(el('div.th', { text: 'گردش‌کار', title: 'مرحله‌ای که پرونده در آن است' }));
    fields.forEach(function (f) {
      var active = app.state.sortKey === f.key;
      header.appendChild(el('div.th' + (active ? '.sorted' : ''), {
        title: f.label,
        onclick: function () {
          if (app.state.sortKey === f.key) {
            app.state.sortDir = app.state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            app.state.sortKey = f.key;
            app.state.sortDir = 'asc';
          }
          app.refresh();
        }
      }, [
        el('span', { text: f.label.replace(/[*]/g, '').replace(/\(\d[^)]*\)/g, '').trim() }),
        active ? el('span.sort-arrow', { text: app.state.sortDir === 'asc' ? '▲' : '▼' }) : null
      ]));
    });

    var viewport = el('div.tbody-viewport');
    var spacer = el('div.tbody-spacer');
    spacer.style.height = (rows.length * ROW_H) + 'px';
    spacer.appendChild(viewport);

    var scroller = el('div.tscroll');
    scroller.appendChild(header);
    scroller.appendChild(spacer);

    var lastStart = -1;

    function paint() {
      var top = scroller.scrollTop;
      var visible = Math.ceil(scroller.clientHeight / ROW_H) + OVERSCAN * 2;
      var start = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
      if (start === lastStart) return;
      lastStart = start;
      var end = Math.min(rows.length, start + visible);
      w.U.clear(viewport);
      viewport.style.transform = 'translateY(' + (start * ROW_H) + 'px)';
      for (var i = start; i < end; i++) {
        viewport.appendChild(makeRow(app, rows[i], fields, template, i));
      }
    }

    scroller.addEventListener('scroll', function () {
      window.requestAnimationFrame(paint);
    });

    setTimeout(paint, 0);
    return { node: scroller, paint: function () { lastStart = -1; paint(); } };
  }

  function makeRow(app, rec, fields, template, i) {
    var action = w.Worklist.nextAction(rec);
    var urgency = '';
    if (action.key === 'closed') urgency = '.done-row';
    else if (action.overdue) urgency = '.late';
    else if (action.remaining != null && action.remaining <= 3) urgency = '.due';

    var row = el('div.trow.tr' + (i % 2 ? '.odd' : '') + urgency, {
      tabindex: '0',
      title: action.key === 'closed' ? 'مختومه'
        : (action.label + (action.days != null
          ? ' — ' + w.U.toFaDigits(action.days) + ' روز' : '')),
      onclick: function () { app.openCase(rec.id); },
      onkeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.openCase(rec.id); }
      }
    });
    row.style.gridTemplateColumns = template;

    var pick = el('input', {
      type: 'checkbox', checked: !!app.state.selected[rec.id],
      'aria-label': 'انتخاب پروندهٔ ' + (rec.caseNo || '')
    });
    pick.addEventListener('click', function (e) { e.stopPropagation(); });
    pick.addEventListener('change', function () {
      app.toggleSelect(rec.id, pick.checked);
      row.classList.toggle('picked', pick.checked);
      app.refreshSelectionBar();
    });
    if (pick.checked) row.classList.add('picked');
    row.appendChild(el('div.td.td-pick', null, [pick]));

    row.appendChild(el('div.td.td-rail', null, [w.UIWorklist.rail(rec, 'mini')]));
    fields.forEach(function (f) {
      var text = cellText(rec, f);
      var cell = el('div.td', { title: text });
      if (f.key === 'status') {
        cell.appendChild(el('span.pill.' + (statusClass(text) || 'st-none'), { text: text }));
      } else if (f.key === 'caseNo') {
        cell.appendChild(el('span.reg-no', { text: w.U.toLatinDigits(text) }));
      } else {
        cell.textContent = text;
      }
      row.appendChild(cell);
    });
    return row;
  }

  // ------------------------------------------------------------------ صفحه
  function render(app, mount) {
    var rows = M.query({
      q: app.state.q, filters: app.state.filters,
      sortKey: app.state.sortKey, sortDir: app.state.sortDir
    });
    app.state.lastResult = rows;

    var total = M.state.cases.length;
    var summary = el('div.result-bar', null, [
      el('span.result-count', {
        html: '<b>' + w.U.toFaDigits(rows.length) + '</b> پرونده' +
          (rows.length !== total ? ' از ' + w.U.toFaDigits(total) : '')
      }),
      el('div.spacer'),
      el('button.btn.small.ghost', {
        type: 'button', text: 'ورود از اکسل',
        title: 'خواندن فایل اکسل با همین قالب و پر کردن خودکار فیلدها',
        onclick: function () { w.UIMisc.importExcel(app); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'ستون‌های جدول',
        onclick: function () { w.UIMisc.columnsDialog(app); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'چاپ فهرست',
        onclick: function () { w.UIPrint.printList(rows); }
      }),
      el('button.btn.small', {
        type: 'button', text: 'خروجی اکسل از این نتیجه',
        onclick: function () { w.UIMisc.exportExcel(rows); }
      })
    ]);

    var note = app.state.filterNote ? el('div.filter-note', null, [
      el('span.fn-icon', { text: '⌖', 'aria-hidden': 'true' }),
      el('span', { text: 'نمایش نتیجهٔ گزارش: ' }),
      el('b', { text: app.state.filterNote }),
      el('div.spacer'),
      el('button.btn.small.ghost', {
        type: 'button', text: 'برداشتن این برش',
        onclick: function () { app.clearFilterNote(); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: '← بازگشت به گزارش',
        onclick: function () { app.goReport(); }
      })
    ]) : null;

    var table = buildTable(app, rows);
    var body = rows.length
      ? table.node
      : el('div.empty-state', null, [
        el('p', { text: total ? 'هیچ پرونده‌ای با این جستجو پیدا نشد.' : 'هنوز پرونده‌ای ثبت نشده است.' }),
        el('button.btn.primary', {
          type: 'button', text: 'ثبت پروندهٔ جدید',
          onclick: function () { app.newCase(); }
        })
      ]);

    // نوار اقدام دسته‌ای — فقط وقتی چیزی انتخاب شده باشد
    var selBar = el('div.sel-bar');
    app.refreshSelectionBar = function () {
      var ids = app.selectedIds();
      w.U.clear(selBar);
      selBar.classList.toggle('on', ids.length > 0);
      if (!ids.length) return;
      selBar.appendChild(el('b.sel-count', {
        text: w.U.toFaDigits(ids.length) + ' پرونده انتخاب شده'
      }));
      selBar.appendChild(el('div.spacer'));
      selBar.appendChild(el('button.btn.small.ghost', {
        type: 'button', text: 'خروجی اکسل از انتخاب‌شده‌ها',
        onclick: function () {
          w.UIMisc.exportExcel(ids.map(function (id) { return M.get(id); }));
        }
      }));
      selBar.appendChild(el('button.btn.small.ghost', {
        type: 'button', text: 'برداشتن انتخاب',
        onclick: function () { app.clearSelection(); app.render(); }
      }));
      selBar.appendChild(el('button.btn.small.primary', {
        type: 'button', text: 'اقدام دسته‌ای',
        onclick: function () {
          w.UIBulk.dialog(app, ids, 'انتخاب از فهرست', function () {
            app.clearSelection();
            app.render();
          });
        }
      }));
    };

    w.U.clear(mount);
    mount.appendChild(el('div.list-layout', null, [
      el('aside.sidebar', null, [renderFilters(app), w.UIMisc.statsPanel(app)]),
      el('section.list-main', null, [note, summary, body, selBar])
    ]));
    app.refreshSelectionBar();
  }

  w.UIList = { render: render, statusClass: statusClass, cellText: cellText, colWidth: colWidth };
})(window);
