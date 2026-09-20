/*
 * نمای تقویم.
 *
 * چیدمان عمداً «تقویم دیواری» است، نه جدولِ داده: شبکهٔ هفت‌ستونی از شنبه،
 * جمعه‌ها کم‌رنگ، امروز نشان‌دار. کسی که این صفحه را باز می‌کند دنبال یک
 * روز است، نه دنبال مرتب‌سازی و صافی.
 *
 * دو تصمیم:
 *
 *   ۱) خانهٔ روز خلاصه است، نه کامل. حداکثر سه سطر و بعد «+۴ مورد». اگر
 *      هرچه در روز هست داخل خانه بریزد، ماه نامفهوم می‌شود و خانه‌ها
 *      قدنامساوی. جزئیات با یک کلیک، در پانل کنار می‌آید.
 *
 *   ۲) هر سطر می‌رود جایی. کلیک روی هر مورد یا پرونده‌اش را باز می‌کند یا
 *      — برای کارِ بی‌پرونده — پنجرهٔ خود آن کار را. تقویمی که فقط نگاه
 *      کردنی باشد، دفعهٔ دوم باز نمی‌شود.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, C = w.Calendar;

  function fa(n) { return w.U.toFaDigits(n); }

  var WEEK = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
  var SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  /** رفتن به مقصد هر مورد: پرونده، یا خودِ کار اگر پرونده‌ای ندارد */
  function go(app, item) {
    if (item.caseId) {
      if (item.layer === 'task' || item.layer === 'follow') {
        app.state.formTab = '__notes';
      }
      app.openCase(item.caseId);
      return;
    }
    if (item.taskId) {
      var task = w.Notes.all().filter(function (n) { return n.id === item.taskId; })[0];
      if (task) {
        w.UITasks.dialog(app, { task: task }, function () { app.render(); });
        return;
      }
    }
    app.goTasks();
  }

  function itemRow(app, item, compact) {
    var cls = 'button.cal-item.l-' + item.layer +
      (item.done ? '.is-done' : '') + (item.urgent ? '.is-urgent' : '');
    return el(cls, {
      type: 'button',
      title: item.label + ' — ' + item.sub,
      onclick: function (e) { e.stopPropagation(); go(app, item); }
    }, [
      el('span.cal-dot'),
      el('span.cal-item-text', { text: item.label }),
      compact ? null : el('span.cal-item-sub', { text: item.sub })
    ]);
  }

  function render(app, mount) {
    var st = app.state;
    if (!st.calLayers) st.calLayers = C.DEFAULT_ON.slice();
    if (!st.calMonth) {
      var t = J.unpack(J.today());
      st.calMonth = { jy: t.jy, jm: t.jm };
    }
    if (!st.calDay) st.calDay = J.today();

    var data = C.month(st.calMonth.jy, st.calMonth.jm, st.calLayers);

    function goMonth(n) {
      st.calMonth = C.shift(st.calMonth.jy, st.calMonth.jm, n);
      app.render();
    }

    // ------------------------------------------------------------- سربرگ
    var head = el('header.cal-head', null, [
      el('div.cal-nav', null, [
        el('button.icon-btn.cal-arrow', {
          type: 'button', title: 'ماه قبل', 'aria-label': 'ماه قبل',
          html: w.Mobile.icon('chevronRight'),
          onclick: function () { goMonth(-1); }
        }),
        el('h1.cal-title', { text: fa(data.label) }),
        el('button.icon-btn.cal-arrow', {
          type: 'button', title: 'ماه بعد', 'aria-label': 'ماه بعد',
          html: w.Mobile.icon('chevronLeft'),
          onclick: function () { goMonth(1); }
        }),
        el('button.btn.small.ghost', {
          type: 'button', text: 'امروز',
          onclick: function () {
            var t = J.unpack(J.today());
            st.calMonth = { jy: t.jy, jm: t.jm };
            st.calDay = J.today();
            app.render();
          }
        }),
        el('span.wl-count', { text: fa(data.total) + ' مورد در این ماه' })
      ]),
      el('div.cal-layers', null, C.LAYERS.map(function (l) {
        var on = st.calLayers.indexOf(l.key) >= 0;
        return el('button.chip-btn.cal-chip.t-' + l.key + (on ? '.on' : ''), {
          type: 'button', text: l.label,
          title: on ? 'برای پنهان کردن کلیک کنید' : 'برای نشان دادن کلیک کنید',
          onclick: function () {
            st.calLayers = on
              ? st.calLayers.filter(function (k) { return k !== l.key; })
              : st.calLayers.concat([l.key]);
            app.render();
          }
        }, [el('span.cal-dot')]);
      }))
    ]);

    // -------------------------------------------------------------- شبکه
    var grid = el('div.cal-grid');
    grid.appendChild(el('div.cal-weekdays', null, WEEK.map(function (d, i) {
      return el('div.cal-wd' + (i === 6 ? '.off' : ''), null, [
        el('span.cal-wd-long', { text: d }),
        el('span.cal-wd-short', { text: SHORT[i] })
      ]);
    })));

    data.weeks.forEach(function (row) {
      var line = el('div.cal-week');
      row.forEach(function (cell) {
        var cls = 'button.cal-day';
        if (!cell.inMonth) cls += '.out';
        if (cell.today) cls += '.today';
        if (cell.friday) cls += '.off';
        if (cell.date === st.calDay) cls += '.picked';
        if (!cell.items.length) cls += '.empty';

        var shown = cell.items.slice(0, 3);
        var rest = cell.items.length - shown.length;

        line.appendChild(el(cls, {
          type: 'button',
          title: J.format(cell.date, { long: true }) + ' — ' +
            (cell.items.length ? fa(cell.items.length) + ' مورد' : 'خالی'),
          onclick: function () { st.calDay = cell.date; app.render(); }
        }, [
          el('span.cal-daynum', { text: fa(cell.jd) }),
          cell.today ? el('span.cal-todaytag', { text: 'امروز' }) : null,
          el('div.cal-day-items', null, shown.map(function (it) {
            return itemRow(app, it, true);
          })),
          rest > 0 ? el('span.cal-more', { text: '+' + fa(rest) + ' مورد' }) : null
        ]));
      });
      grid.appendChild(line);
    });

    // ------------------------------------------------------- پانل یک روز
    var dayItems = data.byDate[st.calDay] || [];
    var dp = J.unpack(st.calDay);
    var panel = el('aside.cal-panel', null, [
      el('div.cal-panel-head', null, [
        el('h2', { text: J.weekday(dp.jy, dp.jm, dp.jd) + '، ' +
          J.format(st.calDay, { long: true }) }),
        el('span.wl-count' + (st.calDay === J.today() ? '.late' : ''), {
          text: st.calDay === J.today() ? 'امروز'
            : w.UINotes.relativeDay(st.calDay)
        })
      ])
    ]);

    if (!dayItems.length) {
      panel.appendChild(el('p.muted.tiny', {
        text: 'این روز چیزی ثبت نشده است.'
      }));
    } else {
      /* گروه‌بندی بر اساس لایه: «چه چیزهایی از یک جنس» راحت‌تر از یک
         فهرست بلندِ درهم خوانده می‌شود. */
      C.LAYERS.forEach(function (l) {
        var mine = dayItems.filter(function (it) { return it.layer === l.key; });
        if (!mine.length) return;
        panel.appendChild(el('div.cal-group', null, [
          el('h3.cal-group-head', null, [
            el('span.cal-dot.t-' + l.key),
            el('span', { text: l.label }),
            el('span.cal-group-n', { text: fa(mine.length) })
          ])
        ].concat(mine.map(function (it) { return itemRow(app, it, false); }))));
      });
    }

    panel.appendChild(el('button.btn.small.ghost.cal-add', {
      type: 'button', text: '＋ کار تازه برای این روز',
      onclick: function () {
        w.UITasks.dialog(app, { due: st.calDay }, function () { app.render(); });
      }
    }));

    w.U.clear(mount);
    mount.appendChild(el('div.cal-view', null, [
      head,
      el('div.cal-body', null, [grid, panel])
    ]));
  }

  w.UICalendar = { render: render };
})(window);
