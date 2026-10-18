/*
 * کارکرد و گزارش کار — نمای صفحهٔ «کارها».
 *
 * دو تکه:
 *   dayPanel — ستونِ کنارِ کارها: امروز (یا هر روز) چه کردید، روی کدام
 *              پرونده، چقدر، و به چه ترتیبی. هر پرونده باز می‌شود و
 *              رویدادهایش با ساعت دیده می‌شوند.
 *   render   — تبِ «گزارش کار»: یک بازه، با زمان، روز به روز، پرونده به
 *              پرونده، نوعِ کار، و کارها (در مهلت، با تأخیر، میانگین روز
 *              تا انجام، به تفکیک دسته و ارجاع‌دهنده). خروجی اکسل و چاپ.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, WL = w.Worklog;

  function fa(n) { return w.U.toFaDigits(n); }
  function dur(s, short) { return WL.dur(s, short); }

  function caseTitle(c) {
    if (!c.id) return { no: '', name: 'بیرون از پرونده‌ها' };
    return { no: w.U.toLatinDigits(c.caseNo || '—'), name: c.name || 'بی‌نام' };
  }

  function openCase(app, id) {
    if (!id || !M.get(id)) return;
    app.openCase(id);
  }

  /** نشانِ شمارهٔ رویدادها: «ویرایش ۱۲ · فرم ۲ · مینوت ۱» */
  function chips(counts, fields) {
    var box = el('span.wr-chips');
    WL.SORTS.forEach(function (s) {
      var n = counts[s.key];
      if (!n) return;
      var text = s.short + ' ' + fa(n);
      if (s.key === 'edit' && fields) text += ' (' + fa(fields) + ' فیلد)';
      box.appendChild(el('span.wr-chip.s-' + s.key, { text: text }));
    });
    return box;
  }

  function eventList(evs, withDate) {
    return el('ol.wr-events', null, evs.map(function (e) {
      return el('li.wr-ev.s-' + e.sort, null, [
        el('span.wr-ev-t', {
          text: (withDate ? J.format(e.day) + ' ' : '') + (e.time ? fa(e.time) : '—')
        }),
        el('span.wr-ev-l', { text: e.label }),
        e.detail ? el('span.wr-ev-d', { text: e.detail }) : null,
        e.minutes ? el('span.wr-ev-m', { text: dur(e.minutes * 60) }) : null
      ]);
    }));
  }

  /* ================================================== ستونِ کارکردِ روز */
  function dayPanel(app, refresh) {
    var st = app.state;
    var day = st.logDay || J.today();
    var data = WL.build(day, day);
    var d = data.days[0];
    var isToday = day === J.today();

    var stepper = el('div.wr-step', null, [
      el('button.wr-step-b', {
        type: 'button', text: '›', title: 'روز قبل', 'aria-label': 'روز قبل',
        onclick: function () { st.logDay = J.addDays(day, -1); refresh(); }
      }),
      el('div.wr-step-d', null, [
        el('b', { text: isToday ? 'امروز' : d.weekday }),
        el('span', { text: J.format(day, { long: true }) })
      ]),
      el('button.wr-step-b', {
        type: 'button', text: '‹', title: 'روز بعد', 'aria-label': 'روز بعد',
        disabled: isToday,
        onclick: function () { st.logDay = J.addDays(day, 1); refresh(); }
      }),
      isToday ? null : el('button.linkish.tiny', {
        type: 'button', text: 'امروز',
        onclick: function () { st.logDay = ''; refresh(); }
      })
    ]);

    var total = el('div.wr-total', null, [
      el('div.wr-total-n', null, [
        el('b', { text: dur(d.sec) }),
        d.estimated ? el('span.wr-est', { text: 'برآورد', title: 'این روز پیش از زمان‌سنج بوده؛ زمان از فاصلهٔ رویدادها برآورد شده' }) : null
      ]),
      el('div.wr-total-sub', {
        text: [
          d.cases ? fa(d.cases) + ' پرونده' : '',
          d.events ? fa(d.events) + ' رویداد' : '',
          d.tasksDone ? fa(d.tasksDone) + ' کار انجام شد' : '',
          d.start && d.end ? 'از ' + fa(d.start) + ' تا ' + fa(d.end) : ''
        ].filter(Boolean).join(' · ') || 'هنوز کاری ثبت نشده است.'
      }),
      d.manualSec ? el('div.wr-total-sub', {
        text: 'شامل ' + dur(d.manualSec) + ' کارِ ثبت‌شدهٔ دستی (بیرون از برنامه)'
      }) : null
    ]);

    var box = el('aside.wr-day', null, [
      el('div.wr-day-head', null, [
        el('h2', { text: 'کارکرد' }),
        el('div.spacer'),
        el('button.btn.small.primary', {
          type: 'button', text: '＋ ثبت کار انجام‌شده',
          title: 'کاری که بیرون از برنامه انجام دادید (تماس، جلسه، پروندهٔ کاغذی) با زمانش',
          onclick: function () { w.UITasks.dialog(app, { log: true, day: day }, refresh); }
        })
      ]),
      stepper,
      total
    ]);

    // --- پرونده‌های این روز، به ترتیبِ زمان
    var list = data.cases;
    if (list.length) {
      var max = list.reduce(function (m, c) { return Math.max(m, c.total); }, 0) || 1;
      box.appendChild(el('h3.wr-sub', { text: 'روی چه پرونده‌هایی' }));
      box.appendChild(el('div.wr-cases', null, list.map(function (c) {
        var t = caseTitle(c);
        var det = el('details.wr-case' + (c.id ? '' : '.is-free'));
        det.appendChild(el('summary', null, [
          el('div.wr-case-top', null, [
            t.no ? el('span.reg-no', { text: t.no }) : null,
            el('b.wr-case-name', { text: t.name }),
            el('div.spacer'),
            el('span.wr-case-t', { text: dur(c.total, true), title: dur(c.total) })
          ]),
          el('div.wr-bar', null, [el('span', { style: 'width:' + Math.max(4, c.total * 100 / max) + '%' })]),
          chips(c.counts, c.fields)
        ]));
        det.appendChild(eventList(c.events));
        if (c.id) {
          det.appendChild(el('button.linkish.tiny.wr-open', {
            type: 'button', text: 'باز کردن پرونده ←',
            onclick: function () { openCase(app, c.id); }
          }));
        }
        return det;
      })));
    }

    // --- روندِ روز: نشست‌ها
    var bl = d.blocks.filter(function (b) { return !b.untimed; });
    if (bl.length) {
      box.appendChild(el('h3.wr-sub', { text: 'روندِ روز' }));
      box.appendChild(el('ol.wr-timeline', null, bl.map(function (b) {
        var names = b.cases.map(function (c) {
          var rec = c.caseId ? M.get(c.caseId) : null;
          return rec ? w.U.toLatinDigits(rec.caseNo || '') : 'بی‌پرونده';
        });
        return el('li', null, [
          el('span.wr-tl-t', { text: fa(b.start) + (b.end !== b.start ? '–' + fa(b.end) : '') }),
          el('span.wr-tl-x', {
            text: fa(b.events.length) + ' رویداد روی ' +
              (names.length > 3 ? fa(names.length) + ' پرونده' : names.join('، '))
          })
        ]);
      })));
    }

    // --- زمان در صفحه‌ها
    if (data.views.length) {
      box.appendChild(el('p.wr-views', {
        text: 'بیرون از پرونده‌ها: ' + data.views.slice(0, 4).map(function (v) {
          return v.label + ' ' + dur(v.sec, true);
        }).join(' · ')
      }));
    }

    if (!list.length && !bl.length) {
      box.appendChild(el('p.muted.tiny.wr-empty', {
        text: isToday
          ? 'از همین حالا هر دقیقه‌ای که روی پرونده‌ها کار کنید، اینجا می‌آید — ' +
            'با هر ویرایش، فرم، مینوت و سند. کارِ بیرون از برنامه را با «ثبت کار انجام‌شده» بنویسید.'
          : 'در این روز کاری ثبت نشده است.'
      }));
    }
    return box;
  }

  /* ======================================================= گزارش کار */
  var RANGES = [
    { key: 'today', label: 'امروز' },
    { key: 'week', label: 'این هفته' },
    { key: 'lastWeek', label: 'هفتهٔ گذشته' },
    { key: 'month', label: 'این ماه' },
    { key: 'lastMonth', label: 'ماه گذشته' },
    { key: 'custom', label: 'بازهٔ دلخواه' }
  ];

  function rangeOf(st) {
    var key = st.wrRange || 'week';
    if (key === 'today') return { from: J.today(), to: J.today(), label: 'امروز' };
    return w.Karnameh.range(key, st.wrCustom || {});
  }

  function tile(value, label, hint, tone) {
    return el('div.wr-tile' + (tone ? '.' + tone : ''), null, [
      el('b', { text: value }),
      el('span', { text: label }),
      hint ? el('small', { text: hint }) : null
    ]);
  }

  function section(title, sub, body) {
    return el('section.wr-sec', null, [
      el('div.wr-sec-head', null, [el('h3', { text: title }), sub ? el('p', { text: sub }) : null]),
      body
    ]);
  }

  function table(head, rows, cls) {
    return el('div.table-scroll', null, [el('table.c-table.wr-table' + (cls || ''), null, [
      el('thead', null, [el('tr', null, head.map(function (h) { return el('th', { text: h }); }))]),
      el('tbody', null, rows)
    ])]);
  }

  /** نمودارِ ستونیِ روز به روز — زمانِ ثبت‌شده، دستی و برآورد، روی هم */
  function dayChart(app, data) {
    var max = data.days.reduce(function (m, d) { return Math.max(m, d.sec); }, 0) || 1;
    var many = data.days.length > 40;
    var chart = el('div.wr-chart' + (many ? '.is-dense' : ''), { role: 'img',
      'aria-label': 'زمان کار روز به روز' });
    data.days.forEach(function (d) {
      var col = el('button.wr-col' + (d.holiday ? '.is-off' : '') + (d.date === J.today() ? '.is-today' : ''), {
        type: 'button',
        title: d.weekday + ' ' + J.format(d.date) + ' — ' + dur(d.sec) +
          (d.estimated ? ' (برآورد)' : '') + (d.events ? '، ' + fa(d.events) + ' رویداد' : ''),
        onclick: function () { app.state.taskTab = 'work'; app.state.logDay = d.date; app.render(); }
      }, [
        el('span.wr-col-bar', null, [
          el('span.wr-seg.trk', { style: 'height:' + (d.trackedSec * 100 / max) + '%' }),
          el('span.wr-seg.man', { style: 'height:' + (d.manualSec * 100 / max) + '%' }),
          el('span.wr-seg.est', { style: 'height:' + (d.estSec * 100 / max) + '%' })
        ]),
        el('span.wr-col-l', { text: fa(Number(d.date.slice(6))) })
      ]);
      chart.appendChild(col);
    });
    return el('div', null, [
      chart,
      el('div.wr-legend', null, [
        el('span.k.trk', { text: 'زمانِ ثبت‌شده در برنامه' }),
        el('span.k.man', { text: 'ثبت دستی' }),
        el('span.k.est', { text: 'برآورد (روزهای پیش از زمان‌سنج)' }),
        el('span.muted', { text: 'روی هر روز بزنید تا کارکردِ همان روز باز شود.' })
      ])
    ]);
  }

  function barList(items, fmt) {
    var max = items.reduce(function (m, x) { return Math.max(m, x.v); }, 0) || 1;
    return el('ul.wr-bars', null, items.map(function (x) {
      return el('li', null, [
        el('span.wr-bars-l', { text: x.label }),
        el('span.wr-bars-b', null, [el('span', { style: 'width:' + Math.max(2, x.v * 100 / max) + '%' })]),
        el('span.wr-bars-n', { text: fmt ? fmt(x.v) : fa(x.v) })
      ]);
    }));
  }

  function render(app, mount) {
    var st = app.state;
    var r = rangeOf(st);
    var data = WL.build(r.from, r.to);
    var T = data.totals, K = data.tasks;
    var worked = T.workedDays || 0;

    // --- نوار بازه
    var bar = el('div.wr-range', null, RANGES.map(function (x) {
      return el('button.chip-btn' + ((st.wrRange || 'week') === x.key ? '.on' : ''), {
        type: 'button', text: x.label,
        onclick: function () { st.wrRange = x.key; app.render(); }
      });
    }));
    if ((st.wrRange || 'week') === 'custom') {
      st.wrCustom = st.wrCustom || { from: r.from, to: r.to };
      bar.appendChild(el('span.wr-custom', null, [
        el('span.muted.tiny', { text: 'از' }),
        w.DatePicker.field(st.wrCustom.from, function (v) { st.wrCustom.from = v; if (v) app.render(); }),
        el('span.muted.tiny', { text: 'تا' }),
        w.DatePicker.field(st.wrCustom.to, function (v) { st.wrCustom.to = v; if (v) app.render(); })
      ]));
    }
    bar.appendChild(el('div.spacer'));
    bar.appendChild(el('button.btn.small.ghost', {
      type: 'button', text: 'چاپ', onclick: function () { printIt(data, r); }
    }));
    bar.appendChild(el('button.btn.small', {
      type: 'button', text: 'خروجی اکسل', onclick: function () { excel(data, r); }
    }));

    var head = el('div.wr-head', null, [
      el('h2', { text: 'گزارش کار — ' + J.format(r.from) + (r.to !== r.from ? ' تا ' + J.format(r.to) : '') }),
      el('p.wr-lead', { text: sentence(data) }),
      bar
    ]);

    // --- کاشی‌ها
    var tiles = el('div.wr-tiles', null, [
      tile(dur(T.sec), 'زمان کار',
        T.estSec ? 'شامل ' + dur(T.estSec) + ' برآورد' : (T.manualSec ? 'شامل ' + dur(T.manualSec) + ' ثبت دستی' : ''), 'hero'),
      tile(worked ? dur(T.sec / worked) : '—', 'میانگین هر روز کاری', fa(worked) + ' روز کاری'),
      tile(fa(T.cases), 'پرونده رسیدگی شد', fa(T.events) + ' رویداد'),
      tile(fa(T.edit + T.create), 'ویرایش و ثبت', T.fields ? fa(T.fields) + ' فیلد تغییر کرد' : ''),
      tile(fa(T.form + T.minute), 'فرم و مینوت', fa(T.form) + ' فرم · ' + fa(T.minute) + ' مینوت'),
      tile(fa(T.doc), 'سند و اسکن'),
      tile(fa(K.done), 'کار انجام شد', K.onTimePct != null ? fa(K.onTimePct) + '٪ در مهلت' : '', 'good'),
      tile(fa(K.overdueNow), 'کارِ عقب‌افتادهٔ الان', '', K.overdueNow ? 'bad' : '')
    ]);

    var body = el('div.wr-body');
    body.appendChild(section('زمان، روز به روز', 'هر ستون یک روز؛ جمعه کم‌رنگ است.', dayChart(app, data)));

    // --- پرونده‌ها
    var caseRows = data.cases.slice(0, st.wrAllCases ? 1000 : 25).map(function (c) {
      var t = caseTitle(c);
      var tr = el('tr.wr-tr' + (c.id ? '' : '.is-free'), { tabindex: '0' }, [
        el('td', null, [t.no ? el('span.reg-no', { text: t.no }) : el('span.muted', { text: '—' })]),
        el('td', null, [el('b', { text: t.name }), c.unit ? el('div.muted.tiny', { text: c.unit }) : null]),
        el('td.num', { text: dur(c.total, true), title: dur(c.total) +
          (c.estSec ? ' (برآورد: ' + dur(c.estSec) + ')' : '') + (c.manualSec ? ' (دستی: ' + dur(c.manualSec) + ')' : '') }),
        el('td.num', { text: c.counts.edit ? fa(c.counts.edit) + (c.fields ? ' / ' + fa(c.fields) : '') : '—' }),
        el('td.num', { text: c.counts.form ? fa(c.counts.form) : '—' }),
        el('td.num', { text: c.counts.minute ? fa(c.counts.minute) : '—' }),
        el('td.num', { text: c.counts.doc ? fa(c.counts.doc) : '—' }),
        el('td.num', { text: c.counts.task ? fa(c.counts.task) : '—' }),
        el('td.num', { text: c.events.length ? fa(c.events.length) : '—' }),
        el('td', { text: c.last ? J.format(J.pack.apply(null, (function () {
          var j = J.toJalali(new Date(c.last)); return [j.jy, j.jm, j.jd];
        })())) : '' })
      ]);
      var detail = el('tr.wr-detail', null, [el('td', { colspan: 10 }, [
        eventList(c.events, true),
        c.id ? el('button.linkish.tiny', {
          type: 'button', text: 'باز کردن پرونده ←', onclick: function () { openCase(app, c.id); }
        }) : null
      ])]);
      detail.style.display = 'none';
      function toggle() {
        var open = detail.style.display === 'none';
        detail.style.display = open ? '' : 'none';
        tr.classList.toggle('is-open', open);
      }
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') toggle(); });
      return [tr, detail];
    });
    var flat = [];
    caseRows.forEach(function (p) { flat.push(p[0], p[1]); });
    var casesBody = data.cases.length ? el('div', null, [
      table(['پرونده', 'کارمند', 'زمان', 'ویرایش / فیلد', 'فرم', 'مینوت', 'سند', 'کار', 'رویداد', 'آخرین کار'], flat),
      data.cases.length > 25 && !st.wrAllCases ? el('button.btn.small.ghost', {
        type: 'button', text: 'همهٔ ' + fa(data.cases.length) + ' پرونده',
        onclick: function () { st.wrAllCases = true; app.render(); }
      }) : null
    ]) : el('p.muted', { text: 'در این بازه روی پرونده‌ای کار ثبت نشده است.' });
    body.appendChild(section('پرونده به پرونده', 'به ترتیبِ زمان. روی هر سطر بزنید تا رویدادهایش با تاریخ و ساعت باز شود.', casesBody));

    // --- نوع کار و صفحه‌ها
    var two = el('div.wr-two', null, [
      section('چه نوع کاری', null, data.sorts.length
        ? barList(data.sorts.map(function (s) { return { label: s.label, v: s.n }; }))
        : el('p.muted', { text: 'رویدادی ثبت نشده.' })),
      section('زمان بیرون از پرونده‌ها', 'صفحه‌هایی که در آن‌ها کار کردید.', data.views.length
        ? barList(data.views.map(function (v) { return { label: v.label, v: v.sec }; }), function (v) { return dur(v, true); })
        : el('p.muted', { text: 'زمانی ثبت نشده.' }))
    ]);
    body.appendChild(two);

    // --- کارها
    body.appendChild(section('کارها', 'کارهای آزاد (چک‌لیست‌ها جدا شمرده می‌شوند).', taskBlock(app, K)));

    // --- روز به روز
    var dayRows = data.days.slice().reverse().filter(function (d) { return d.sec || d.events; }).map(function (d) {
      return el('tr', null, [
        el('td', { text: d.weekday }),
        el('td', { text: J.format(d.date) }),
        el('td', { text: d.start ? fa(d.start) + (d.end ? '–' + fa(d.end) : '') : '—' }),
        el('td.num', { text: dur(d.sec, true) + (d.estimated ? ' *' : '') }),
        el('td.num', { text: fa(d.cases) }),
        el('td.num', { text: fa(d.events) }),
        el('td.num', { text: fa(d.fields) }),
        el('td.num', { text: fa(d.tasksDone) })
      ]);
    });
    body.appendChild(section('روز به روز', '* یعنی زمانِ آن روز برآورد است.', dayRows.length
      ? table(['روز', 'تاریخ', 'از–تا', 'زمان', 'پرونده', 'رویداد', 'فیلد', 'کار انجام‌شده'], dayRows)
      : el('p.muted', { text: 'در این بازه روزِ کاری ثبت نشده.' })));

    w.U.clear(mount);
    mount.appendChild(el('div.wr', null, [head, tiles, body]));
  }

  function sentence(data) {
    var T = data.totals, K = data.tasks;
    if (!T.sec && !T.events && !K.done) return 'در این بازه کاری ثبت نشده است.';
    var bits = [];
    if (T.sec) bits.push(dur(T.sec) + ' کار');
    if (T.cases) bits.push('روی ' + fa(T.cases) + ' پرونده');
    var s = bits.join(' ');
    var more = [];
    if (T.form + T.minute) more.push(fa(T.form + T.minute) + ' فرم و مینوت');
    if (T.doc) more.push(fa(T.doc) + ' سند');
    if (K.done) more.push(fa(K.done) + ' کار انجام‌شده');
    return (s ? s + '؛ ' : '') + more.join('، ') + (more.length ? '.' : '');
  }

  function taskBlock(app, K) {
    var box = el('div.wr-tasks');
    box.appendChild(el('div.wr-tiles.small', null, [
      tile(fa(K.created), 'ثبت شد'),
      tile(fa(K.done), 'انجام شد', '', 'good'),
      tile(K.onTimePct != null ? fa(K.onTimePct) + '٪' : '—', 'در مهلت', fa(K.onTime) + ' در مهلت · ' + fa(K.late) + ' با تأخیر'),
      tile(K.avgDays == null ? '—' : (K.avgDays === 0 ? 'همان روز' : fa(K.avgDays) + ' روز'), 'میانگینِ ثبت تا انجام'),
      tile(fa(K.cancelled), 'لغو شد'),
      tile(K.minutes ? dur(K.minutes * 60) : '—', 'زمانِ ثبت‌شدهٔ دستی'),
      tile(fa(K.openNow), 'باز و در مهلتِ الان'),
      tile(fa(K.overdueNow), 'عقب‌افتادهٔ الان', '', K.overdueNow ? 'bad' : '')
    ]));
    function rows(list) {
      return list.map(function (x) {
        return el('tr', null, [
          el('td', { text: x.key }),
          el('td.num', { text: fa(x.created) }),
          el('td.num', { text: fa(x.done) }),
          el('td.num', { text: fa(x.onTime) }),
          el('td.num' + (x.late ? '.late' : ''), { text: fa(x.late) }),
          el('td.num', { text: fa(x.cancelled) }),
          el('td.num', { text: fa(x.open) }),
          el('td.num' + (x.overdue ? '.late' : ''), { text: fa(x.overdue) }),
          el('td.num', { text: x.minutes ? dur(x.minutes * 60, true) : '—' })
        ]);
      });
    }
    var H = ['ثبت', 'انجام', 'در مهلت', 'با تأخیر', 'لغو', 'باز', 'عقب', 'زمان دستی'];
    box.appendChild(el('div.wr-two', null, [
      el('div', null, [el('h4', { text: 'به تفکیک دسته' }),
        K.byCategory.length ? table(['دسته'].concat(H), rows(K.byCategory)) : el('p.muted.tiny', { text: 'کاری نیست.' })]),
      el('div', null, [el('h4', { text: 'به تفکیک ارجاع‌دهنده' }),
        K.byFrom.length ? table(['ارجاع‌دهنده'].concat(H), rows(K.byFrom)) : el('p.muted.tiny', { text: 'کاری نیست.' })])
    ]));
    if (K.doneList.length) {
      box.appendChild(el('h4', { text: 'کارهای انجام‌شده' }));
      box.appendChild(table(['تاریخ', 'کار', 'پرونده', 'دسته', 'ارجاع', 'مهلت', 'زمان'],
        K.doneList.slice(0, 200).map(function (n) {
          var rec = n.caseId ? M.get(n.caseId) : null;
          var tone = n.followUp ? (n.doneAt <= n.followUp ? 'در مهلت' : 'با تأخیر') : '';
          return el('tr', null, [
            el('td', { text: J.format(n.doneAt) }),
            el('td', { text: n.title || '' }),
            el('td', null, [rec ? el('button.linkish.tiny', {
              type: 'button', text: w.U.toLatinDigits(rec.caseNo || '') + ' ' + WL.nameOf(rec),
              onclick: function () { openCase(app, rec.id); }
            }) : el('span.muted', { text: '—' })]),
            el('td', { text: n.category || '—' }),
            el('td', { text: n.from || '—' }),
            el('td' + (tone === 'با تأخیر' ? '.late' : ''), { text: tone || '—' }),
            el('td.num', { text: n.minutes ? dur(n.minutes * 60, true) : '—' })
          ]);
        })));
    }
    return box;
  }

  /* ------------------------------------------------------- خروجی‌ها */
  function minutes(sec) { return Math.round((sec || 0) / 60); }

  function excel(data, r) {
    var T = data.totals, K = data.tasks;
    var summary = [['شاخص', 'مقدار'],
      ['بازه', J.format(r.from, { latin: true }) + ' تا ' + J.format(r.to, { latin: true })],
      ['زمان کار (دقیقه)', minutes(T.sec)], ['زمانِ ثبت‌شده در برنامه (دقیقه)', minutes(T.trackedSec)],
      ['ثبت دستی (دقیقه)', minutes(T.manualSec)], ['برآورد (دقیقه)', minutes(T.estSec)],
      ['روز کاری', T.workedDays], ['پرونده', T.cases], ['رویداد', T.events],
      ['فیلد تغییرکرده', T.fields], ['فرم', T.form], ['مینوت', T.minute], ['سند', T.doc],
      ['کار ثبت‌شده', K.created], ['کار انجام‌شده', K.done], ['در مهلت', K.onTime], ['با تأخیر', K.late],
      ['لغو', K.cancelled], ['عقب‌افتادهٔ الان', K.overdueNow]];
    var days = [['تاریخ', 'روز', 'شروع', 'پایان', 'زمان (دقیقه)', 'برآورد؟', 'پرونده', 'رویداد', 'فیلد', 'کار انجام‌شده']]
      .concat(data.days.map(function (d) {
        return [J.format(d.date, { latin: true }), d.weekday, d.start, d.end, minutes(d.sec),
          d.estimated ? 'بله' : '', d.cases, d.events, d.fields, d.tasksDone];
      }));
    var cases = [['شماره پرونده', 'کارمند', 'واحد', 'زمان (دقیقه)', 'ویرایش', 'فیلد', 'فرم', 'مینوت', 'سند', 'کار', 'رویداد']]
      .concat(data.cases.map(function (c) {
        return [w.U.toLatinDigits(c.caseNo || ''), c.name || (c.id ? '' : 'بیرون از پرونده‌ها'), c.unit,
          minutes(c.total), c.counts.edit || 0, c.fields, c.counts.form || 0, c.counts.minute || 0,
          c.counts.doc || 0, c.counts.task || 0, c.events.length];
      }));
    var evs = [['تاریخ', 'ساعت', 'شماره پرونده', 'نوع', 'رویداد', 'جزئیات', 'دقیقهٔ دستی']];
    data.cases.forEach(function (c) {
      c.events.forEach(function (e) {
        evs.push([J.format(e.day, { latin: true }), e.time, w.U.toLatinDigits(c.caseNo || ''),
          (WL.SORTS.filter(function (s) { return s.key === e.sort; })[0] || {}).label || '', e.label,
          e.detail, e.minutes || '']);
      });
    });
    var tasks = [['تاریخ انجام', 'کار', 'شماره پرونده', 'دسته', 'ارجاع‌دهنده', 'سررسید', 'دقیقه']]
      .concat(K.doneList.map(function (n) {
        var rec = n.caseId ? M.get(n.caseId) : null;
        return [J.format(n.doneAt, { latin: true }), n.title || '', rec ? w.U.toLatinDigits(rec.caseNo || '') : '',
          n.category || '', n.from || '', n.followUp ? J.format(n.followUp, { latin: true }) : '', n.minutes || ''];
      }));
    var blob = w.XLSX.build([
      { name: 'خلاصه', rows: summary, widths: [30, 24] },
      { name: 'روزانه', rows: days, widths: [12, 10, 8, 8, 12, 8, 8, 8, 8, 12] },
      { name: 'پرونده‌ها', rows: cases, widths: [14, 22, 22, 12, 8, 8, 8, 8, 8, 8, 8] },
      { name: 'رویدادها', rows: evs, widths: [12, 8, 14, 14, 28, 50, 10] },
      { name: 'کارها', rows: tasks, widths: [12, 36, 14, 18, 18, 12, 8] }
    ]);
    w.U.download('gozaresh-kar-' + r.from + '-' + r.to + '.xlsx', blob);
  }

  function printIt(data, r) {
    var T = data.totals, K = data.tasks;
    function ptable(head, rows) {
      return el('table.p-table', null, [
        el('thead', null, [el('tr', null, head.map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', null, rows.map(function (row) {
          return el('tr', null, row.map(function (c) { return el('td', { text: String(c) }); }));
        }))
      ]);
    }
    w.UIPrint.printNodes('گزارش کار', J.format(r.from) + ' تا ' + J.format(r.to), [
      el('div.p-section', null, [el('p', { text: sentence(data) })]),
      el('div.p-section', null, [el('h2', { text: 'خلاصه' }), ptable(['شاخص', 'مقدار'], [
        ['زمان کار', dur(T.sec)], ['روز کاری', fa(T.workedDays)], ['پرونده', fa(T.cases)],
        ['رویداد', fa(T.events)], ['فرم و مینوت', fa(T.form + T.minute)], ['سند', fa(T.doc)],
        ['کار انجام‌شده', fa(K.done) + (K.onTimePct != null ? ' (' + fa(K.onTimePct) + '٪ در مهلت)' : '')]
      ])]),
      el('div.p-section', null, [el('h2', { text: 'پرونده‌ها' }), ptable(
        ['پرونده', 'کارمند', 'زمان', 'ویرایش', 'فرم', 'مینوت', 'سند', 'کار'],
        data.cases.slice(0, 60).map(function (c) {
          return [w.U.toLatinDigits(c.caseNo || '—'), c.name || (c.id ? '' : 'بیرون از پرونده‌ها'),
            dur(c.total, true), fa(c.counts.edit || 0), fa(c.counts.form || 0), fa(c.counts.minute || 0),
            fa(c.counts.doc || 0), fa(c.counts.task || 0)];
        }))]),
      el('div.p-section', null, [el('h2', { text: 'روز به روز' }), ptable(
        ['روز', 'تاریخ', 'زمان', 'پرونده', 'رویداد', 'کار'],
        data.days.filter(function (d) { return d.sec || d.events; }).map(function (d) {
          return [d.weekday, J.format(d.date), dur(d.sec, true), fa(d.cases), fa(d.events), fa(d.tasksDone)];
        }))])
    ]);
  }

  w.UIWorkReport = { dayPanel: dayPanel, render: render, excel: excel, RANGES: RANGES };
})(window);
