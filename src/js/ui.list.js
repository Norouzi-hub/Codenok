/* نمای فهرست: جستجو، فیلترها و جدول با رندر مجازی */
(function (w) {
  'use strict';

  var el = w.U.el, $ = w.U.$, J = w.J, M = w.Model;
  var ROW_H = 38;
  var CARD_H = 120;   // ارتفاع ثابت کارت موبایل، تا رندر مجازی سر جایش بماند
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
    if (status.indexOf('ارجاع به کارشناس') >= 0) return 'st-moved';
    if (status.indexOf('مختومه') >= 0) return 'st-done';
    if (status.indexOf('انتظار') >= 0) return 'st-wait';
    if (status.indexOf('مفتوح') >= 0) return 'st-open';
    if (status.indexOf('دستور کار') >= 0) return 'st-queued';
    if (status.indexOf('رای') >= 0 || status.indexOf('رأی') >= 0) return 'st-verdict';
    return '';
  }

  // ------------------------------------------------------------------ فیلترها
  /*
   * هر گروه فیلتر دو حالت دارد: «شامل» و «به‌جز».
   *
   * تا امروز فقط «شامل» بود، و برای کنار گذاشتن یک مقدار باید همهٔ
   * مقدارهای دیگر تیک می‌خورد — با هشت واحد سازمانی یعنی هفت کلیک برای
   * حذف یکی. «به‌جز» همان کار را با یک کلیک می‌کند.
   *
   * دو حالت در یک گروه با هم قاطی نمی‌شوند: کلید یکی است و حالت، جای
   * نشستنش را تعیین می‌کند (filters[key] یا filters._not[key]). فهرست
   * دوگانه یعنی کاربر باید بفهمد «هم شاملِ الف و هم به‌جزِ ب» چه معنایی
   * دارد، و جوابش معمولاً هیچ.
   */
  function filterMode(app, key) {
    return ((app.state.filters._not || {})[key] || []).length ? 'not' : 'in';
  }

  function filterValues(app, key) {
    var mode = filterMode(app, key);
    return (mode === 'not'
      ? (app.state.filters._not || {})[key]
      : app.state.filters[key]) || [];
  }

  function setFilter(app, key, values, mode) {
    var f = app.state.filters;
    f._not = f._not || {};
    delete f[key];
    delete f._not[key];
    if (values.length) {
      if (mode === 'not') f._not[key] = values;
      else f[key] = values;
    }
    if (!Object.keys(f._not).length) delete f._not;
    app.refresh();
  }

  function renderFilters(app) {
    var box = el('div.filters');
    box.appendChild(el('div.filters-head', null, [
      el('h3', { text: 'فیلترها' }),
      el('div.spacer'),
      /* دامنه بالای فیلترهاست چون از آنها بالاتر است: فیلتر برای همین
         جستجوست، دامنه برای همهٔ برنامه. */
      el('button.linkish.tiny', {
        type: 'button',
        text: M.scopeIsOn() ? 'دامنه: ' + w.UIScope.summary() : 'دامنهٔ کار',
        title: 'کدام پرونده‌ها در همهٔ صفحه‌ها شمرده شوند',
        onclick: function () { w.UIScope.dialog(app); }
      })
    ]));
    box.appendChild(activeChips(app));

    FILTER_FIELDS.forEach(function (ff) {
      var values = M.distinct(ff.key);
      if (!values.length) return;
      var mode = filterMode(app, ff.key);
      var selected = filterValues(app, ff.key);
      var details = el('details.filter-group' + (mode === 'not' ? '.is-not' : ''),
        { open: selected.length > 0 });
      details.appendChild(el('summary', null, [
        el('span', { text: ff.label }),
        selected.length ? el('span.badge' + (mode === 'not' ? '.neg' : ''), {
          text: (mode === 'not' ? '−' : '') + w.U.toFaDigits(selected.length)
        }) : null
      ]));

      var modeRow = el('div.filter-mode', { role: 'group', 'aria-label': 'حالت فیلتر' });
      [{ k: 'in', t: 'شامل' }, { k: 'not', t: 'به‌جز' }].forEach(function (o) {
        modeRow.appendChild(el('button.fm-btn' + (mode === o.k ? '.on' : ''), {
          type: 'button', text: o.t,
          title: o.k === 'in'
            ? 'فقط این مقدارها نشان داده شوند'
            : 'همه‌چیز نشان داده شود به‌جز این مقدارها',
          onclick: function (e) {
            e.preventDefault();
            setFilter(app, ff.key, filterValues(app, ff.key), o.k);
          }
        }));
      });
      details.appendChild(modeRow);

      var list = el('div.filter-options');
      values.forEach(function (v) {
        var count = M.state.cases.filter(function (c) { return (c[ff.key] || '') === v; }).length;
        var id = 'f-' + ff.key + '-' + w.U.normalize(v).replace(/\s/g, '-');
        var cb = el('input', {
          type: 'checkbox', id: id, checked: selected.indexOf(v) >= 0,
          onchange: function () {
            var cur = filterValues(app, ff.key).slice();
            if (this.checked) cur.push(v);
            else cur = cur.filter(function (x) { return x !== v; });
            setFilter(app, ff.key, cur, filterMode(app, ff.key));
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
    /* ستون ساعت فقط وقتی می‌آید که در همین نتیجه، دستِ‌کم یک پرونده مهلت
       دفاعیهٔ باز داشته باشد. یک ستونِ همیشه‌خالی، هم جا می‌گیرد و هم
       چشم را عادت می‌دهد به ندیدنش. */
    var hasClock = rows.some(function (r) { return !!w.Worklist.defenseWatch(r); });
    // ستون‌های ثابت (انتخاب، ساعت، گردش‌کار) پیش از ستون‌های انتخابی کاربر
    var template = '38px ' + (hasClock ? '52px ' : '') + '132px ' +
      fields.map(function (f) { return colWidth(f) + 'px'; }).join(' ');

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
    if (hasClock) {
      header.appendChild(el('div.th.th-clock', {
        html: w.Mobile.icon('clock'),
        title: 'مهلت حضور و ارائهٔ دفاعیه — هرچه قرص پُرتر، مهلت کمتر'
      }));
    }
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
        viewport.appendChild(makeRow(app, rows[i], fields, template, i, hasClock));
      }
    }

    scroller.addEventListener('scroll', function () {
      window.requestAnimationFrame(paint);
    });

    setTimeout(paint, 0);
    return { node: scroller, paint: function () { lastStart = -1; paint(); } };
  }

  // ------------------------------------------------- کارت‌های موبایل
  /* روی گوشی، جدول چندستونی خوانده نمی‌شود. هر پرونده یک کارت است: شمارهٔ ثبت،
     وضعیت، نام، و اقدام بعدی — همان چیزی که با یک نگاه لازم است. */
  function buildCards(app, rows) {
    var viewport = el('div.cards-viewport');
    var spacer = el('div.cards-spacer');
    spacer.style.height = (rows.length * CARD_H) + 'px';
    spacer.appendChild(viewport);

    var scroller = el('div.cards-scroll');
    scroller.appendChild(spacer);

    var lastStart = -1;

    function paint() {
      var visible = Math.ceil(scroller.clientHeight / CARD_H) + OVERSCAN * 2;
      var start = Math.max(0, Math.floor(scroller.scrollTop / CARD_H) - OVERSCAN);
      if (start === lastStart) return;
      lastStart = start;
      var end = Math.min(rows.length, start + visible);
      w.U.clear(viewport);
      viewport.style.transform = 'translateY(' + (start * CARD_H) + 'px)';
      for (var i = start; i < end; i++) viewport.appendChild(makeCard(app, rows[i]));
    }

    scroller.addEventListener('scroll', function () {
      window.requestAnimationFrame(paint);
    }, { passive: true });

    setTimeout(paint, 0);
    return { node: scroller, paint: function () { lastStart = -1; paint(); } };
  }

  function makeCard(app, rec) {
    var action = w.Worklist.nextAction(rec);
    var cls = '';
    if (action.key === 'closed') cls = '.done-row';
    else if (action.overdue) cls = '.late';
    else if (action.remaining != null && action.remaining <= 3) cls = '.due';

    var card = el('article.case-card' + cls + (app.state.selected[rec.id] ? '.picked' : ''), {
      tabindex: '0',
      onclick: function () { app.openCase(rec.id); },
      onkeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.openCase(rec.id); }
      }
    });

    var pick = el('input.card-pick', {
      type: 'checkbox', checked: !!app.state.selected[rec.id],
      'aria-label': 'انتخاب پروندهٔ ' + (rec.caseNo || '')
    });
    pick.addEventListener('click', function (e) { e.stopPropagation(); });
    pick.addEventListener('change', function () {
      app.toggleSelect(rec.id, pick.checked);
      card.classList.toggle('picked', pick.checked);
      app.refreshSelectionBar();
    });

    var status = rec.status || '';
    card.appendChild(el('div.card-top', null, [
      pick,
      el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') }),
      status ? el('span.pill.' + (statusClass(status) || 'st-none'), { text: status }) : null,
      el('div.spacer'),
      el('span.card-date', { text: rec.intakeDate ? J.format(rec.intakeDate) : '' })
    ]));

    var who = w.Person.fullName(rec);
    card.appendChild(el('div.card-name', {
      text: who || 'بدون نام', title: who
    }));

    var meta = [rec.orgUnit, rec.expert].filter(Boolean).join(' • ');
    card.appendChild(el('div.card-foot', null, [
      w.UIWorklist.rail(rec, 'mini'),
      w.UIWorklist.clock(rec),
      el('span.card-action', { text: action.label || '' }),
      action.days != null && action.key !== 'closed'
        ? el('span.card-days' + (action.overdue ? '.late' : ''), {
          text: w.U.toFaDigits(action.days) + ' روز'
        }) : null
    ]));
    if (meta) card.appendChild(el('div.card-meta', { text: meta, title: meta }));
    return card;
  }

  function makeRow(app, rec, fields, template, i, hasClock) {
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

    if (hasClock) {
      row.appendChild(el('div.td.td-clock', null, [w.UIWorklist.clock(rec)]));
    }
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

  // -------------------------------------------------- فیلتر و ابزار روی موبایل
  function activeFilterCount(app) {
    var f = app.state.filters;
    var n = Object.keys(f).filter(function (k) {
      return k.charAt(0) !== '_' && (f[k] || []).length;
    }).length;
    return n + Object.keys(f._not || {}).filter(function (k) {
      return (f._not[k] || []).length;
    }).length;
  }

  /**
   * چیپ‌های فیلترِ فعال.
   * صافی‌ای که فقط در یک لیست تیک‌خورده پیدا می‌شود، فراموش می‌شود و
   * بعد کاربر می‌پرسد «چرا این پرونده نیست؟». هر چیپ می‌گوید چه چیزی
   * اعمال شده و با یک کلیک برمی‌دارَدش.
   */
  function activeChips(app) {
    var wrap = el('div.filter-chips');
    var f = app.state.filters;
    FILTER_FIELDS.forEach(function (ff) {
      var mode = filterMode(app, ff.key);
      var vals = filterValues(app, ff.key);
      if (!vals.length) return;
      vals.forEach(function (v) {
        wrap.appendChild(el('button.fchip' + (mode === 'not' ? '.neg' : ''), {
          type: 'button',
          title: 'برداشتن این صافی',
          onclick: function () {
            setFilter(app, ff.key, vals.filter(function (x) { return x !== v; }), mode);
          }
        }, [
          el('span.fchip-op', { text: mode === 'not' ? 'به‌جز' : '' }),
          el('span.fchip-v', { text: v }),
          el('span.fchip-x', { text: '×' })
        ]));
      });
    });
    if (f._from || f._to) {
      wrap.appendChild(el('button.fchip', {
        type: 'button', title: 'برداشتن بازهٔ زمانی',
        onclick: function () {
          delete f._from; delete f._to;
          app.refresh();
        }
      }, [
        el('span.fchip-v', {
          text: (f._from ? J.format(f._from) : '…') + ' تا ' +
            (f._to ? J.format(f._to) : '…')
        }),
        el('span.fchip-x', { text: '×' })
      ]));
    }
    if (!wrap.children.length) wrap.style.display = 'none';
    return wrap;
  }

  function openFilterSheet(app) {
    var body = el('div.filter-sheet', null, [renderFilters(app), w.UIMisc.statsPanel(app)]);
    var m = w.U.modal('فیلترها', body, [
      el('button.btn.primary', {
        type: 'button', text: 'نمایش نتیجه',
        onclick: function () { m.close(); }
      })
    ]);
    // هر تغییر فیلتر، فهرست پشت سر را بازمی‌سازد؛ شیت باید باز بماند
    m.root.classList.add('filter-modal');
  }

  function openListTools(app, rows) {
    w.Mobile.sheet('ابزارهای فهرست', [
      {
        icon: 'imp', label: 'ورود از اکسل',
        hint: 'همین قالب را می‌خواند و فیلدها را پر می‌کند',
        onclick: function () { w.UIMisc.importExcel(app); }
      },
      {
        icon: 'exp', label: 'خروجی اکسل از این نتیجه',
        hint: w.U.toFaDigits(rows.length) + ' پرونده',
        onclick: function () { w.UIMisc.exportExcel(rows); }
      },
      {
        icon: 'print', label: 'چاپ فهرست',
        onclick: function () { w.UIPrint.printList(rows); }
      },
      {
        icon: 'columns', label: 'ستون‌های جدول',
        hint: 'برای نمای رایانه و چاپ',
        onclick: function () { w.UIMisc.columnsDialog(app); }
      },
      { sep: true },
      {
        icon: 'check', label: 'انتخاب همهٔ این نتیجه',
        hint: 'برای اقدام دسته‌ای',
        onclick: function () {
          rows.forEach(function (r) { app.toggleSelect(r.id, true); });
          app.render();
        }
      }
    ]);
  }

  // ------------------------------------------------------------------ صفحه
  function render(app, mount) {
    var rows = M.query({
      q: app.state.q, filters: app.state.filters,
      sortKey: app.state.sortKey, sortDir: app.state.sortDir
    });
    app.state.lastResult = rows;

    var total = M.scoped().length;
    var phone = w.Mobile.isPhone();
    var countNode = el('span.result-count', {
      html: '<b>' + w.U.toFaDigits(rows.length) + '</b> پرونده' +
        (rows.length !== total ? ' از ' + w.U.toFaDigits(total) : '')
    });

    var summary = phone
      ? el('div.result-bar.mobile', null, [
        countNode,
        el('div.spacer'),
        el('button.btn.small.ghost', {
          type: 'button', onclick: function () { openFilterSheet(app); }
        }, [
          el('span', { text: 'فیلترها' }),
          activeFilterCount(app)
            ? el('span.badge', { text: w.U.toFaDigits(activeFilterCount(app)) }) : null
        ]),
        el('button.btn.small.ghost', {
          type: 'button', text: '⋯', 'aria-label': 'ابزارهای فهرست',
          onclick: function () { openListTools(app, rows); }
        })
      ])
      : el('div.result-bar', null, [
        countNode,
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

    var table = rows.length ? (phone ? buildCards(app, rows) : buildTable(app, rows)) : null;
    // وقتی جستجو/فیلتری فعال است، کار بعدیِ کاربر «برداشتن آن» است، نه
    // ساختن پروندهٔ تازه؛ دکمهٔ اصلی باید همان باشد.
    var narrowed = !!(app.state.q || activeFilterCount(app) ||
      app.state.filters._from || app.state.filters._to || app.state.filters._idSet ||
      app.state.filters._stage);
    var body = rows.length
      ? table.node
      : el('div.empty-state', null, total
        ? [
          el('p', {
            text: narrowed
              ? 'هیچ‌کدام از ' + w.U.toFaDigits(total) + ' پرونده با این جستجو و فیلترها نمی‌خواند.'
              : 'پرونده‌ای برای نمایش نیست.'
          }),
          narrowed ? el('p.muted.tiny', {
            text: app.state.q ? 'جستجو: «' + app.state.q + '»' : 'فیلترها فعال‌اند.'
          }) : null,
          el('div.btn-row', null, [
            narrowed ? el('button.btn.primary', {
              type: 'button', text: 'پاک کردن جستجو و فیلترها',
              onclick: function () {
                app.state.q = '';
                app.state.filters = {};
                app.state.filterNote = '';
                app.refresh(true);
              }
            }) : null,
            el('button.btn' + (narrowed ? '' : '.primary'), {
              type: 'button', text: 'ثبت پروندهٔ جدید',
              onclick: function () { app.newCase(); }
            })
          ])
        ]
        : [
          el('p', { text: 'هنوز پرونده‌ای ثبت نشده است.' }),
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
      // روی موبایل نوار اقدام شناور است؛ آخرین کارت نباید زیرش گم شود
      if (selBar.parentNode) selBar.parentNode.classList.toggle('has-sel', ids.length > 0);
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
      selBar.appendChild(el('button.btn.small.ghost', {
        type: 'button', text: 'ارجاع به کارشناس دیگر',
        title: 'این پرونده‌ها از کارتابل شما بیرون می‌روند',
        onclick: function () {
          w.UITransfer.dialog(app, ids, function () {
            app.clearSelection();
            app.render();
          });
        }
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
    mount.appendChild(el('div.list-layout' + (phone ? '.phone' : ''), null, [
      phone ? null
        : el('aside.sidebar', null, [renderFilters(app), w.UIMisc.statsPanel(app)]),
      el('section.list-main', null,
        [w.UIScope.banner(app), note, summary, body, selBar])
    ]));
    app.refreshSelectionBar();
  }

  w.UIList = {
    render: render, statusClass: statusClass, cellText: cellText, colWidth: colWidth
  };
})(window);
