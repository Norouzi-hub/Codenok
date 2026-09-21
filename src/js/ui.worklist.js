/* کارتابل: صفحهٔ نخست — چه کاری شده و چه کاری مانده */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, WL = w.Worklist;

  function fa(n) { return w.U.toFaDigits(n); }

  /** شمارهٔ پرونده مثل یک شمارهٔ ثبت دبیرخانه، با ارقام لاتین و قلم داده */
  function caseNumber(rec) {
    return el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') });
  }

  // ------------------------------------------------------------ ریل گردش‌کار
  /**
   * ریل گردش‌کار — نشانهٔ امضای برنامه.
   * هشت گرهٔ پشت‌سرهم: پرشده یعنی انجام شده، حلقهٔ برنجی یعنی همین‌جا ایستاده‌ایم.
   * در سه اندازه ظاهر می‌شود: ریز در سطرهای فهرست، کامل در صفحهٔ پرونده،
   * و تجمیعی در کارتابل.
   */
  /**
   * ریل گردش‌کار. با onPick، هر گره دکمه می‌شود و کلیک روی آن کلیدِ
   * فیلدِ همان مرحله را پس می‌دهد — یعنی «روی آیکن بزن، برو سرِ همان
   * فیلد». بدون آن، ریل همان چیز خواندنیِ قبلی است (فهرست و کارتابل).
   */
  function rail(rec, size, onPick) {
    var steps = WL.stages(rec);
    var box = el('ol.rail.rail-' + (size || 'mini'), {
      'aria-label': 'گردش‌کار پرونده'
    });
    steps.forEach(function (st, i) {
      var cls = 'li.rail-step';
      if (st.done) cls += '.done';
      if (st.current) cls += '.current';
      if (st.manual) cls += '.manual';
      if (st.optional && !st.date) cls += '.opt';
      if (i === 0) cls += '.first';
      var pickable = onPick && st.field;
      if (pickable) cls += '.pick';
      var hint = st.date ? ' — ' + J.format(st.date)
        : (st.optional ? ' — اختیاری، هنوز ثبت نشده' : ' — هنوز ثبت نشده');
      var node = el(cls, {
        title: st.label + hint + (st.manual ? ' — مرحلهٔ دستی' : '') +
          (pickable ? '\nبرای رفتن به همین فیلد کلیک کنید' : ''),
        role: pickable ? 'button' : null,
        tabindex: pickable ? '0' : null,
        onclick: pickable ? function () { onPick(st.field, st); } : null,
        onkeydown: pickable ? function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick(st.field, st);
          }
        } : null
      }, [
        el('span.rail-dot'),
        size === 'full' ? el('span.rail-name', { text: st.short }) : null,
        size === 'full' ? el('span.rail-date', {
          text: st.date ? J.format(st.date)
            : (st.current ? (st.manual ? 'دستی' : 'اکنون') : '')
        }) : null
      ]);
      box.appendChild(node);
    });
    return box;
  }

  /** ریل تجمیعی: چند پرونده روی هر مرحله ایستاده‌اند */
  function pipelineRail(app, cases) {
    var data = WL.pipeline(cases);
    var total = cases.length || 1;
    var box = el('ol.rail.rail-pipe');
    data.forEach(function (st, i) {
      var pct = Math.round((st.value / total) * 100);
      box.appendChild(el('li.rail-step' + (st.value ? '.done' : '') + (i === 0 ? '.first' : ''), {
        title: st.label + ' — ' + fa(st.value) + ' پرونده (' + fa(pct) + '٪)'
      }, [
        el('span.rail-dot'),
        el('span.rail-count', { text: fa(st.value) }),
        el('span.rail-name', { text: st.short })
      ]));
    });
    return box;
  }

  /* ================================================================
     نوار امروز
     ----------------------------------------------------------------
     یک نوار، چهار قطعه، هر قطعه به اندازهٔ سهمش. کلِ بارِ باز را در یک
     خط می‌گوید: چقدرش از مهلت گذشته، چقدرش امروز است، چقدر تا آخر هفته،
     و چقدر آرام.
     
     چرا نوار و نه چهار کارت دیگر: کارت‌ها عدد می‌دهند، نوار «نسبت» می‌دهد.
     تفاوتِ «۴ از ۳۰» با «۲۴ از ۳۰» را باید دید، نه خواند و حساب کرد. و
     چون تنها چیزِ پررنگ صفحه است، بقیه می‌توانند آرام بمانند.
     ================================================================ */
  var RIB = [
    { key: 'late', label: 'از مهلت گذشته', hint: 'کارِ امروز، با تأخیر' },
    { key: 'today', label: 'سررسید امروز', hint: 'همین امروز باید انجام شود' },
    { key: 'week', label: 'تا هفت روز آینده', hint: 'در راه است' },
    { key: 'calm', label: 'آرام', hint: 'مهلتش دور است یا مهلتی ندارد' }
  ];

  function ribbonData(cases) {
    var today = J.today();
    var out = { late: [], today: [], week: [], calm: [] };
    cases.forEach(function (rec) {
      var a = WL.nextAction(rec);
      if (!a || a.key === 'closed' || a.key === 'transferred') return;
      if (a.overdue) { out.late.push(rec.id); return; }
      var d = a.due ? J.diffDays(today, a.due) : null;   // منفی = آینده
      if (d === 0) out.today.push(rec.id);
      else if (d != null && -d <= 7) out.week.push(rec.id);
      else out.calm.push(rec.id);
    });
    return out;
  }

  function dayRibbon(app, cases) {
    var data = ribbonData(cases);
    var total = RIB.reduce(function (n, r) { return n + data[r.key].length; }, 0);
    if (!total) return null;

    var bar = el('div.ribbon', { role: 'group', 'aria-label': 'بار کاری امروز' });
    RIB.forEach(function (r, i) {
      var ids = data[r.key];
      if (!ids.length) return;
      var pct = Math.round((ids.length / total) * 100);
      var seg = el('button.rib-seg.r-' + r.key, {
        type: 'button',
        style: '--w:' + pct + '%;--i:' + i,
        title: r.label + ' — ' + fa(ids.length) + ' پرونده (' + fa(pct) + '٪). ' +
          r.hint + '. برای دیدن فهرستشان کلیک کنید.',
        onclick: function () { app.showCases(ids, r.label); }
      }, [
        el('span.rib-n', { text: fa(ids.length) }),
        el('span.rib-label', { text: r.label })
      ]);
      bar.appendChild(seg);
    });

    var legend = el('div.rib-legend', null, RIB.filter(function (r) {
      return data[r.key].length;
    }).map(function (r) {
      return el('span.rib-key.r-' + r.key, null, [
        el('i.rib-swatch'), el('span', { text: r.label }),
        el('b', { text: fa(data[r.key].length) })
      ]);
    }));

    return el('div.ribbon-wrap', null, [bar, legend]);
  }

  /* خط شمارشِ دفتر — به‌جای هفت جعبهٔ هم‌اندازه.
     هفت کارتِ مساوی یعنی هفت چیزِ هم‌ارزش، که نیستند. اینجا عددها در یک
     خط می‌نشینند، با خط‌های مویی بینشان، مثل سطر جمعِ ته دفتر. */
  function tally(items) {
    var row = el('div.wl-tally');
    items.filter(Boolean).forEach(function (t, i) {
      var num = el('span.tally-n');
      var node = el((t.ids && t.ids.length ? 'button' : 'div') +
        '.tally' + (t.tone ? '.t-' + t.tone : '') +
        (t.ids && t.ids.length ? '' : '.is-zero'), {
        type: t.ids && t.ids.length ? 'button' : null,
        style: '--i:' + i,
        title: t.hint + (t.ids && t.ids.length ? ' — برای دیدن فهرستشان کلیک کنید' : ''),
        onclick: t.onclick || null
      }, [num, el('span.tally-label', { text: t.label })]);
      w.U.countUp(num, t.value);
      row.appendChild(node);
    });
    return row;
  }

  // ------------------------------------------------------------ هفتهٔ پیشِ رو
  /**
   * نوار هفته: هفت روز آینده، و اینکه هر روز چند چیز سررسید می‌شود.
   * دیرکردها اینجا نمی‌آیند — آنها جای خودشان را در بالای صفحه دارند.
   * این نوار برای «چه چیزی دارد می‌رسد» است، نه «چه چیزی گذشته».
   */
  function weekStrip(app, cases) {
    var slots = WL.week(cases, 7);
    var total = slots.reduce(function (n, s) { return n + s.count; }, 0);
    if (!total) return null;

    var strip = el('ol.week-strip');
    slots.forEach(function (s) {
      var cls = 'li.week-day';
      if (s.offset === 0) cls += '.today';
      if (!s.count) cls += '.empty';
      var title = s.count
        ? (s.deadlines.length ? fa(s.deadlines.length) + ' مهلت اقدام' : '') +
          (s.deadlines.length && s.follows.length ? ' و ' : '') +
          (s.follows.length ? fa(s.follows.length) + ' قرار پیگیری' : '')
        : 'چیزی سررسید نمی‌شود';

      var cell = el(s.count ? 'button' + cls.slice(2) : cls, {
        title: J.format(s.date) + ' — ' + title,
        type: s.count ? 'button' : null,
        onclick: s.count ? function () {
          app.showCases(s.ids, 'سررسید ' +
            (s.offset === 0 ? 'امروز' : s.weekday + ' ' + fa(s.day)));
        } : null
      }, [
        el('span.week-name', { text: s.offset === 0 ? 'امروز' : s.weekday }),
        el('span.week-num', { text: fa(s.day) }),
        s.count ? el('span.week-count', { text: fa(s.count) }) : el('span.week-dash', { text: '—' }),
        s.follows.length ? el('span.week-follow', {
          title: fa(s.follows.length) + ' قرار پیگیری', text: '•'
        }) : null
      ]);
      strip.appendChild(cell);
    });

    var deadlines = slots.reduce(function (n, s) { return n + s.deadlines.length; }, 0);
    var follows = slots.reduce(function (n, s) { return n + s.follows.length; }, 0);
    var bits = [];
    if (deadlines) bits.push(fa(deadlines) + ' مهلت اقدام');
    if (follows) bits.push(fa(follows) + ' قرار پیگیری');

    return el('section.wl-section.week-card', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: 'این هفته' }),
        el('p.wl-sub', { text: bits.join(' و ') + ' تا هفت روز آینده سررسید می‌شود.' })
      ]),
      strip
    ]);
  }

  // ------------------------------------------------------------------ سطرها
  function actionRow(app, item) {
    var rec = item.rec, action = item.action;
    var person = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    var wait = action.days == null ? '' : fa(action.days) + ' روز';
    /* یادداشتِ خودِ کاربر، زیر همان سطر. برنامه «اقدام بعدی» را حساب
       می‌کند، ولی چیزی که آدم نوشته («منتظر پاسخ حراستیم») را هیچ فیلدی
       نمی‌گوید. بدون آن، کارتابل نصف ماجرا را نشان می‌دهد. */
    var note = w.Notes.headline(rec.id);
    var row = el('button.wl-row' + (action.overdue ? '.overdue' : '') +
      (note ? '.has-note' : ''), {
      type: 'button',
      onclick: function () { app.openCase(rec.id); }
    }, [
      caseNumber(rec),
      el('span.wl-person', { text: person || 'بدون نام' }),
      el('span.wl-unit', { text: rec.orgUnit || '' }),
      rail(rec, 'mini'),
      el('span.wl-wait' + (action.overdue ? '.late' : ''), {
        text: wait,
        title: action.limit
          ? 'مهلت ' + fa(action.limit) + ' روز' : 'بدون مهلت تعریف‌شده'
      }),
      el('span.wl-go', { text: '↵', 'aria-hidden': 'true' })
    ]);
    if (note) {
      var late = note.followUp && J.diffDays(J.today(), note.followUp) > 0;
      row.appendChild(el('span.wl-note' + (late ? '.late' : ''), null, [
        el('span.wl-note-icon', { html: w.Mobile.icon('paperclip') }),
        el('span.wl-note-text', { text: w.Notes.preview(w.Notes.textOf(note), 110) }),
        note.followUp ? el('span.wl-note-due', {
          text: w.UINotes.relativeDay(note.followUp)
        }) : null
      ]));
    }
    return row;
  }

  function bucketBlock(app, bucket) {
    var open = bucket.overdue > 0 || bucket.items.length <= 12;
    var head = el('summary.wl-head', null, [
      el('span.wl-title', { text: bucket.label }),
      el('span.wl-owner', { text: bucket.owner }),
      el('span.spacer'),
      el('button.btn.small.ghost.bucket-bulk', {
        type: 'button', text: 'اقدام دسته‌ای',
        title: 'یک تغییر روی همهٔ پرونده‌های این دسته',
        onclick: function (e) {
          e.preventDefault();
          e.stopPropagation();
          w.UIBulk.dialog(app, bucket.items.map(function (i) { return i.rec.id; }),
            bucket.label, function () { app.render(); });
        }
      }),
      bucket.overdue ? el('span.wl-badge.late', {
        text: fa(bucket.overdue) + ' از مهلت گذشته'
      }) : null,
      el('span.wl-badge', { text: fa(bucket.items.length) + ' پرونده' })
    ]);
    var body = el('div.wl-rows', null, bucket.items.slice(0, 50).map(function (it) {
      return actionRow(app, it);
    }));
    if (bucket.items.length > 50) {
      body.appendChild(el('button.wl-more', {
        type: 'button',
        text: 'نمایش همهٔ ' + fa(bucket.items.length) + ' پرونده در فهرست',
        onclick: function () {
          app.showCases(bucket.items.map(function (i) { return i.rec.id; }), bucket.label);
        }
      }));
    }
    var box = el('details.wl-bucket' + (bucket.overdue ? '.has-late' : ''), { open: open });
    box.appendChild(head);
    box.appendChild(body);
    return box;
  }

  /**
   * «امروز چه شد» — تاشده، زیر کارهای امروز.
   *
   * عمداً جمع‌شده است: کارتابل جای «چه مانده» است و اگر کارهای انجام‌شده
   * بازشان بگذاریم، بخش مهم‌تر را پایین می‌رانند. ولی باید یک کلیک
   * فاصله داشته باشد، چون همین می‌شود گزارش آخر هفته.
   */
  function todayLog(app) {
    var today = J.today();
    var k = w.Karnameh.build(today, today, {});
    var t = k.totals;
    var n = t.tasksDone + t.docs + t.letters + t.created + t.closed;
    if (!n) return null;

    var bits = [];
    if (t.letters) bits.push(fa(t.letters) + ' نامه');
    if (t.sessions) bits.push(fa(t.sessions) + ' جلسه');
    if (t.docs) bits.push(fa(t.docs) + ' سند');
    if (t.tasksDone) bits.push(fa(t.tasksDone) + ' کار');
    if (t.created) bits.push(fa(t.created) + ' پروندهٔ تازه');
    if (t.closed) bits.push(fa(t.closed) + ' مختومه');

    var box = el('details.wl-today-log', null, [
      el('summary', null, [
        el('span.wl-log-tick', { text: '✓' }),
        el('span', { text: 'امروز: ' + bits.join('، ') }),
        el('div.spacer'),
        el('span.muted.tiny', { text: 'کارنامه ←' })
      ])
    ]);

    var list = el('ul.wl-log-list');
    k.tasks.done.slice(0, 8).forEach(function (task) {
      list.appendChild(el('li', null, [
        el('span.wl-log-tick', { text: '✓' }),
        el('span', { text: task.title || '' }),
        task.batchId ? el('button.linkish.tiny', {
          type: 'button', text: 'در بایگانی ←',
          onclick: function () {
            app.state.archive = {
              q: '', tags: [], batchId: task.batchId, scope: '', kind: ''
            };
            app.goArchive();
          }
        }) : null
      ]));
    });
    k.steps.slice(0, 6).forEach(function (st) {
      list.appendChild(el('li', null, [
        el('span.wl-log-dot'),
        el('span', { text: st.label }),
        el('b', { text: fa(st.n) })
      ]));
    });
    box.appendChild(list);
    box.appendChild(el('button.btn.small.ghost.wl-log-more', {
      type: 'button', text: 'کارنامهٔ این هفته',
      onclick: function () {
        app.state.reportTab = 'karnameh';
        app.state.karnameh = { range: 'week', custom: { from: '', to: '' }, user: '' };
        app.goReport();
      }
    }));
    return box;
  }

  // ------------------------------------------------------------------ صفحه
  function render(app, mount) {
    var cases = M.scoped();
    var sum = WL.summary(cases);
    var all = WL.buckets(cases);
    var ours = all.filter(function (b) { return b.ours; });
    var theirs = all.filter(function (b) { return !b.ours; });
    var ready = WL.readyForCommittee(cases);

    var t = J.unpack(J.today());
    var weekdayName = J.weekday(t.jy, t.jm, t.jd);
    var todayText = J.format(J.today(), { long: true });

    var headline;
    if (!sum.open) {
      headline = 'هیچ پروندهٔ بازی نمانده است.';
    } else if (sum.overdue === sum.open) {
      headline = fa(sum.open) + ' پروندهٔ در جریان — همه از مهلت گذشته‌اند.';
    } else if (sum.overdue) {
      headline = fa(sum.open) + ' پروندهٔ در جریان، که ' + fa(sum.overdue) +
        ' تای آنها از مهلت گذشته‌اند.';
    } else {
      headline = fa(sum.open) + ' پروندهٔ در جریان، همه در مهلت.';
    }
    if (sum.transferred) {
      headline += ' (' + fa(sum.transferred) + ' پرونده به کارشناس دیگری ارجاع شده.)';
    }

    function idsWhere(fn) {
      return cases.filter(fn).map(function (c) { return c.id; });
    }

    var ts = w.Notes.stats();
    var stats = tally([
      {
        value: sum.overdue, label: 'از مهلت گذشته', tone: 'late',
        hint: 'پرونده‌هایی که از مهلت اقدامشان گذشته',
        ids: idsWhere(function (c) {
          var a = WL.nextAction(c);
          return a.key !== 'closed' && a.overdue;
        }),
        onclick: function () {
          app.showCases(idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && a.overdue;
          }), 'از مهلت گذشته');
        }
      },
      {
        value: sum.ours, label: 'منتظر اقدام ما',
        hint: 'کاری که انجامش با دبیرخانه یا کارشناس است',
        ids: idsWhere(function (c) {
          var a = WL.nextAction(c);
          return a.key !== 'closed' && WL.isOurs(a);
        }),
        onclick: function () {
          app.showCases(idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && WL.isOurs(a);
          }), 'منتظر اقدام ما');
        }
      },
      {
        value: sum.theirs, label: 'منتظر دیگران',
        hint: 'پرونده‌هایی که توپ در زمین ما نیست',
        ids: idsWhere(function (c) {
          var a = WL.nextAction(c);
          return a.key !== 'closed' && !WL.isOurs(a);
        }),
        onclick: function () {
          app.showCases(idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && !WL.isOurs(a);
          }), 'منتظر دیگران');
        }
      },
      {
        value: ts.dueTasks, label: 'کار امروز',
        tone: ts.overdueTasks ? 'late' : '',
        hint: 'کارهایی که سررسیدشان رسیده یا گذشته',
        ids: ts.dueTasks ? [1] : [],
        onclick: function () { app.goTasks(); }
      },
      {
        value: ts.openFollowUps, label: 'پیگیری باز',
        hint: 'قرارهای پیگیری که هنوز بسته نشده‌اند',
        ids: (function () {
          /* کارِ بی‌پرونده هم در سررسیدها می‌آید و rec ندارد؛ این شمارنده
             فهرستِ پرونده باز می‌کند، پس فقط پرونده‌دارها به کارش می‌آیند. */
          var seen = {};
          w.Notes.dueFollowUps(false).forEach(function (f) {
            if (f.rec) seen[f.rec.id] = 1;
          });
          return Object.keys(seen);
        })(),
        onclick: function () {
          var seen = {};
          w.Notes.dueFollowUps(false).forEach(function (f) {
            if (f.rec) seen[f.rec.id] = 1;
          });
          app.showCases(Object.keys(seen), 'پیگیری باز');
        }
      },
      /* کارتابل تا امروز فقط «چه مانده» را می‌گفت. آدمی که آخر هفته باید
         گزارش بدهد، لازم دارد «چه شد» را هم ببیند — همان لحظه، نه در
         گزارش ماهانه. */
      (function () {
        var k = w.Karnameh.build(J.today(), J.today(), {});
        var n = k.totals.tasksDone + k.totals.docs + k.totals.letters;
        return {
          value: n, label: 'انجام‌شدهٔ امروز', tone: n ? 'done' : '',
          hint: 'کار، سند و نامهٔ امروز — برای دیدن کارنامه کلیک کنید',
          ids: n ? [1] : [],
          onclick: function () {
            app.state.reportTab = 'karnameh';
            app.state.karnameh = {
              range: 'custom', custom: { from: J.today(), to: J.today() }, user: ''
            };
            app.goReport();
          }
        };
      })(),
      {
        value: sum.closed, label: 'مختومه', tone: 'done',
        hint: 'پرونده‌های مختومه‌شده',
        ids: idsWhere(function (c) { return WL.isClosed(c); }),
        onclick: function () {
          app.showCases(idsWhere(function (c) { return WL.isClosed(c); }), 'مختومه');
        }
      },
      /* ارجاع‌شده فقط وقتی شمرده می‌شود که در دامنه باشد؛ اگر کاربر گفته
         «اینها کار من نیستند»، شمارنده‌اش هم نباید ادعای خلافش را بکند. */
      sum.transferred ? {
        value: sum.transferred, label: 'ارجاع‌شده',
        hint: 'پرونده‌هایی که به کارشناس دیگری ارجاع شده‌اند',
        ids: idsWhere(function (c) { return WL.isTransferred(c); }),
        onclick: function () {
          app.showCases(idsWhere(function (c) { return WL.isTransferred(c); }),
            'ارجاع‌شده');
        }
      } : null
    ]);

    // جلسه هر وقت تشکیل می‌شود، نه فقط وقتی برنامه پرونده‌ای را «آماده» بداند؛
    // پس ثبت صورت‌جلسه باید همیشه یک کلیک فاصله داشته باشد.
    var heroActions = el('div.wl-hero-actions', null, [
      el('button.btn.small.primary', {
        type: 'button', text: 'ثبت نتیجهٔ جلسه',
        title: 'صورت‌جلسه: نتیجهٔ هر پرونده، از روی دستور کار',
        onclick: function () {
          w.UISession.dialog(app, ready, function () { app.render(); });
        }
      }),
      ready.length ? el('button.btn.small.ghost', {
        type: 'button', text: 'چاپ دستور کار',
        title: fa(ready.length) + ' پروندهٔ آمادهٔ طرح',
        onclick: function () { w.UIPrint.printAgenda(ready); }
      }) : null
    ]);

    var sections = [];

    /*
     * پیگیری‌های دستی — اول از همه، چون قرارِ خودتان است نه حدسِ برنامه.
     *
     * اینها با سطرهای گردش‌کار فرق دارند و نباید شکل آنها را داشته باشند:
     * آنجا یک مرحلهٔ محاسبه‌شده است، اینجا یادداشتی که خودتان نوشته‌اید و
     * متنش مهم است. پس کارت‌اند، نه سطرِ جدول — با نوار رنگی که فوریت را
     * می‌گوید و متن یادداشت در دو خط جا می‌شود.
     */
    /* فقط یادداشت‌ها: کارها بخش خودشان را دارند و نشان دادنشان در هر دو
       جا یعنی کاربر یک چیز را دو بار می‌بیند و نمی‌داند کدام درست است. */
    var follow = w.Notes.dueFollowUps(true).filter(function (f) {
      return f.rec && f.note.kind !== 'task';
    });
    if (follow.length) {
      var late = follow.filter(function (f) { return f.overdue; }).length;
      sections.push(el('section.wl-section.follow-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'قرارهای پیگیری' }),
          el('span.wl-count' + (late ? '.late' : ''), {
            text: late ? fa(late) + ' عقب‌افتاده از ' + fa(follow.length)
              : fa(follow.length) + ' مورد'
          }),
          el('p.wl-sub', { text: 'قرارهایی که خودتان روی پرونده‌ها گذاشته‌اید.' })
        ]),
        el('div.follow-grid', null, follow.map(function (f) {
          var urgency = f.overdue ? 'late' : (f.days === 0 ? 'today' : 'soon');
          var person = [f.rec.firstName, f.rec.lastName].filter(Boolean).join(' ')
            || 'بدون نام';
          var open = function () {
            app.state.formTab = '__notes';
            app.openCase(f.rec.id);
          };
          return el('article.follow-card.u-' + urgency, null, [
            el('button.follow-main', {
              type: 'button', title: 'باز کردن یادداشت‌های ' + person,
              onclick: open
            }, [
              el('div.follow-top', null, [
                caseNumber(f.rec),
                el('span.follow-person', { text: person }),
                el('div.spacer'),
                el('span.follow-when', {
                  text: w.UINotes.relativeDay(f.note.followUp)
                })
              ]),
              el('p.follow-note', { text: w.Notes.preview(w.Notes.textOf(f.note), 160) })
            ]),
            el('div.follow-foot', null, [
              el('span.follow-date', { text: J.format(f.note.followUp) }),
              el('div.spacer'),
              el('button.btn.small.ghost', {
                type: 'button', text: 'دیدن پرونده', onclick: open
              }),
              el('button.btn.small', {
                type: 'button', text: 'انجام شد',
                onclick: function () {
                  w.Notes.complete(f.note).then(function () { app.render(); });
                }
              })
            ])
          ]);
        }))
      ]));
    }

    /* کارهای امروز، بلافاصله بعد از قرارهای پیگیری: هر دو «قرارِ خودِ
       کاربر»اند، نه حدسِ برنامه، و با هم یک تصویر از امروز می‌دهند. */
    var tasksToday = w.UITasks.todaySection(app);
    if (tasksToday) sections.push(tasksToday);

    var doneToday = todayLog(app);
    if (doneToday) sections.push(doneToday);

    var week = weekStrip(app, cases);
    if (week) sections.push(week);

    sections.push(el('section.wl-pipe-card', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: 'گردش‌کار' }),
        el('p.wl-sub', { text: 'هر گره، پرونده‌هایی که از آن مرحله گذشته‌اند.' })
      ]),
      pipelineRail(app, cases)
    ]));

    if (ours.length) {
      sections.push(el('section.wl-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'منتظر اقدام ما' }),
          el('p.wl-sub', { text: 'کاری که تا انجامش ندهیم، پرونده تکان نمی‌خورد.' })
        ]),
        el('div', null, ours.map(function (b) { return bucketBlock(app, b); }))
      ]));
    }

    if (ready.length) {
      sections.push(el('section.wl-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'آمادهٔ طرح در جلسه' }),
          el('p.wl-sub', {
            text: 'دفاعیه گرفته شده و استعلامی معطل نیست؛ فقط باید در دستور کار بیایند.'
          }),
          el('span.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: 'چاپ دستور کار',
            onclick: function () { w.UIPrint.printAgenda(ready); }
          }),
          el('button.btn.small.primary', {
            type: 'button', text: 'ثبت نتیجهٔ جلسه',
            title: 'صورت‌جلسه: نتیجهٔ هر پرونده از روی همین دستور کار',
            onclick: function () {
              w.UISession.dialog(app, ready, function () { app.render(); });
            }
          })
        ]),
        el('div.wl-rows', null, ready.map(function (rec) {
          return actionRow(app, { rec: rec, action: WL.nextAction(rec) });
        }))
      ]));
    }

    if (theirs.length) {
      sections.push(el('section.wl-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'منتظر دیگران' }),
          el('p.wl-sub', { text: 'توپ در زمین ما نیست؛ ولی دیرکردش را باید پیگیری کرد.' })
        ]),
        el('div', null, theirs.map(function (b) { return bucketBlock(app, b); }))
      ]));
    }

    if (!all.length && !ready.length) {
      sections.push(el('div.empty-state', null, [
        el('p', { text: sum.total
          ? 'همهٔ پرونده‌ها مختومه‌اند. کاری در انتظار نیست.'
          : 'هنوز پرونده‌ای ثبت نشده است.' }),
        el('button.btn.primary', {
          type: 'button', text: 'ثبت پروندهٔ جدید',
          onclick: function () { app.newCase(); }
        })
      ]));
    }

    /*
     * سرصفحه، یک «برگه» است نه یک کارت.
     *
     * روز، بزرگ و اول — چون اولین چیزی که آدم صبح می‌خواهد بداند همین
     * است. بعد یک جملهٔ کامل به فارسی، بعد نوار امروز که نسبت‌ها را
     * می‌گوید، و ته برگه خط شمارش. ترتیب از کلی به جزئی است، مثل هر
     * گزارشی که آدم برای آدم می‌نویسد.
     */
    var hero = el('header.wl-hero', null, [
      el('div.wl-plate', null, [
        el('div.wl-eyebrow', null, [
          el('span.wl-eyebrow-tag', { text: 'کارتابل دبیرخانه' }),
          el('span.wl-eyebrow-date', { text: todayText }),
          el('div.spacer'),
          // اقدام‌ها بالای برگه می‌نشینند، نه زیرش: آنجا آویزان بودند
          heroActions
        ]),
        el('h1.wl-hero-line', null, [
          el('span.wl-weekday', { text: weekdayName }),
          el('span.wl-hero-text', { text: headline })
        ]),
        dayRibbon(app, cases),
        stats
      ])
    ]);

    /* ورودِ پلکانی: هر بخش چند صدم ثانیه بعد از قبلی بالا می‌آید. کار
       تزئین نیست — چشم را از بالا به پایین می‌برد، به همان ترتیبی که
       باید خوانده شود. با prefers-reduced-motion کلاً خاموش است. */
    sections.forEach(function (node, i) {
      if (node && node.style) node.style.setProperty('--i', i);
    });

    w.U.clear(mount);
    mount.appendChild(el('div.worklist', null,
      [w.UIScope.banner(app), hero].concat(sections)));
  }

  w.UIWorklist = { render: render, rail: rail, pipelineRail: pipelineRail,
    caseNumber: caseNumber, weekStrip: weekStrip };
})(window);
