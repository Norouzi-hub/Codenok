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
      if (i === 0) cls += '.first';
      var node = el(cls, { title: st.label + (st.date ? ' — ' + J.format(st.date) : '') }, [
        el('span.rail-dot'),
        size === 'full' ? el('span.rail-name', { text: st.short }) : null,
        size === 'full' ? el('span.rail-date', {
          text: st.date ? J.format(st.date) : (st.current ? 'اکنون' : '')
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

    var stats = el('div.wl-stats', null, [
      el('button.wl-stat' + (sum.overdue ? '.late' : ''), {
        type: 'button', title: 'پرونده‌هایی که از مهلت اقدامشان گذشته',
        onclick: function () {
          var ids = cases.filter(function (c) {
            var a = WL.nextAction(c);
            return a.key !== 'closed' && a.overdue;
          }).map(function (c) { return c.id; });
          if (ids.length) app.showCases(ids, 'از مهلت گذشته');
        }
      }, [
        el('span.wl-stat-num', { text: fa(sum.overdue) }),
        el('span.wl-stat-label', { text: 'از مهلت گذشته' })
      ]),
      el('div.wl-stat', null, [
        el('span.wl-stat-num', { text: fa(sum.ours) }),
        el('span.wl-stat-label', { text: 'منتظر اقدام ما' })
      ]),
      el('div.wl-stat', null, [
        el('span.wl-stat-num', { text: fa(sum.theirs) }),
        el('span.wl-stat-label', { text: 'منتظر پاسخ دیگران' })
      ]),
      el('div.wl-stat', null, [
        el('span.wl-stat-num', { text: fa(sum.closed) }),
        el('span.wl-stat-label', { text: 'مختومه' })
      ])
    ]);

    var sections = [];

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
          el('button.btn.small', {
            type: 'button', text: 'چاپ دستور کار',
            onclick: function () { w.UIPrint.printAgenda(ready); }
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
        stats
      ])
    ].concat(sections)));
  }

  w.UIWorklist = { render: render, rail: rail, pipelineRail: pipelineRail,
    caseNumber: caseNumber };
})(window);
