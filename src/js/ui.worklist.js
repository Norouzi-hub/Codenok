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
  function rail(rec, size) {
    var steps = WL.stages(rec);
    var box = el('ol.rail.rail-' + (size || 'mini'), {
      'aria-label': 'گردش‌کار پرونده'
    });
    steps.forEach(function (st, i) {
      var cls = 'li.rail-step';
      if (st.done) cls += '.done';
      if (st.current) cls += '.current';
      if (st.manual) cls += '.manual';
      if (i === 0) cls += '.first';
      var node = el(cls, {
        title: st.label + (st.date ? ' — ' + J.format(st.date) : '') +
          (st.manual ? ' — مرحلهٔ دستی' : '')
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
    return el('button.wl-row' + (action.overdue ? '.overdue' : ''), {
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

  // ------------------------------------------------------------------ صفحه
  function render(app, mount) {
    var cases = M.state.cases;
    var sum = WL.summary(cases);
    var all = WL.buckets(cases);
    var ours = all.filter(function (b) { return b.ours; });
    var theirs = all.filter(function (b) { return !b.ours; });
    var ready = WL.readyForCommittee(cases);

    var t = J.unpack(J.today());
    var todayText = J.weekday(t.jy, t.jm, t.jd) + '، ' + J.format(J.today(), { long: true });

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

    /* هر پنج کارت آمار یک شکل‌اند، پس هر پنج‌تا هم باید کار کنند: کارتی که
       مثل دکمه دیده می‌شود ولی کاری نمی‌کند، به کاربر دروغ می‌گوید. */
    function statCard(num, label, hint, pick, cls) {
      var ids = num ? pick() : [];
      if (!ids.length) {
        return el('div.wl-stat.wl-stat-off' + (cls || ''), { title: hint }, [
          el('span.wl-stat-num', { text: fa(num) }),
          el('span.wl-stat-label', { text: label })
        ]);
      }
      return el('button.wl-stat' + (cls || ''), {
        type: 'button', title: hint + ' — برای دیدن فهرستشان کلیک کنید',
        onclick: function () { app.showCases(ids, label); }
      }, [
        el('span.wl-stat-num', { text: fa(num) }),
        el('span.wl-stat-label', { text: label })
      ]);
    }

    function idsWhere(fn) {
      return cases.filter(fn).map(function (c) { return c.id; });
    }

    var stats = el('div.wl-stats', null, [
      statCard(sum.overdue, 'از مهلت گذشته',
        'پرونده‌هایی که از مهلت اقدامشان گذشته', function () {
          return idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && a.overdue;
          });
        }, sum.overdue ? '.late' : ''),
      statCard(sum.ours, 'منتظر اقدام ما',
        'کاری که انجامش با دبیرخانه یا کارشناس است', function () {
          return idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && WL.isOurs(a);
          });
        }),
      statCard(sum.theirs, 'منتظر پاسخ دیگران',
        'پرونده‌هایی که توپ در زمین ما نیست', function () {
          return idsWhere(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && !WL.isOurs(a);
          });
        }),
      statCard(w.Notes.stats().openFollowUps, 'پیگیری باز',
        'قرارهای پیگیری که هنوز بسته نشده‌اند', function () {
          var seen = {};
          w.Notes.dueFollowUps(false).forEach(function (f) { seen[f.rec.id] = 1; });
          return Object.keys(seen);
        }),
      statCard(sum.transferred, 'ارجاع‌شده',
        'پرونده‌هایی که به کارشناس دیگری ارجاع شده‌اند', function () {
          return idsWhere(function (c) { return WL.isTransferred(c); });
        }),
      statCard(sum.closed, 'مختومه', 'پرونده‌های مختومه‌شده', function () {
        return idsWhere(function (c) { return WL.isClosed(c); });
      })
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
    var follow = w.Notes.dueFollowUps(true);
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
              el('p.follow-note', { text: w.Notes.preview(f.note.text, 160) })
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

    w.U.clear(mount);
    mount.appendChild(el('div.worklist', null, [
      el('header.wl-hero', null, [
        el('div.wl-hero-date', { text: todayText }),
        el('h1.wl-hero-line', { text: headline }),
        stats,
        heroActions
      ])
    ].concat(sections)));
  }

  w.UIWorklist = { render: render, rail: rail, pipelineRail: pipelineRail,
    caseNumber: caseNumber, weekStrip: weekStrip };
})(window);
