/*
 * کیفیتِ پرونده — رابط.
 *
 *   caseBox  — کادرِ «کیفیت پرونده» بالای پروندهٔ مختومه: با چه نقصی بسته
 *              شد، کدام بعداً تکمیل شد، و دکمهٔ «تکمیل» برای بقیه.
 *   render   — «گزارش‌ها ← کیفیت پرونده‌ها»: درصدِ پرونده‌هایی که کامل بسته
 *              شدند ماه به ماه، مرحله‌ای که بیشتر جا می‌افتد، و فهرستِ
 *              مختومه‌هایی که هنوز چیزی برای تکمیل دارند.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, Q = w.Quality, WL = w.Worklist, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }
  function fmt(d) { return d && J.unpack(d) ? J.format(d) : ''; }
  function monthName(key) {
    var y = key.slice(0, 4), m = +key.slice(4, 6);
    var names = J.MONTHS || ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    return (names[m - 1] || m) + ' ' + fa(y);
  }
  function personName(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بی‌نام';
  }

  /* ------------------------------------------------- کادرِ خودِ پرونده */
  function caseBox(rec, onFix) {
    var q = Q.of(rec);
    if (!q) return null;
    if (!q.measured) {
      return el('div.q-box.is-before', null, [
        el('div.q-head', null, [
          el('span.q-badge', { text: 'کیفیت پرونده' }),
          el('span.q-title', { text: 'پیش از سنجش کیفیت بسته شده' })
        ]),
        el('p.q-note', {
          text: 'این پرونده قبل از آغاز سنجش کیفیت مختومه شده و در آمار کیفیت نمی‌آید.' +
            (q.now.length ? ' مرحله‌های بی‌تاریخِ امروز:' : ' همهٔ مرحله‌های الزامی تاریخ دارند.')
        }),
        q.now.length ? el('div.q-items', null, q.now.map(function (m) {
          return item(m.label, 'open', '', function () { onFix(m.key); });
        })) : null
      ]);
    }
    if (q.complete) {
      return el('div.q-box.is-good', null, [
        el('div.q-head', null, [
          el('span.q-badge', { text: 'کیفیت پرونده' }),
          el('span.q-title', { text: '✓ کامل بسته شد' }),
          el('span.q-when', { text: 'ختم: ' + fmt(q.at) })
        ])
      ]);
    }
    var title = 'موقع ختم: ' + fa(q.missing.length) + ' مرحلهٔ بی‌تاریخ';
    if (q.fixed) title += ' — ' + fa(q.fixed) + ' تا بعداً تکمیل شد';
    return el('div.q-box' + (q.open ? '.is-open' : '.is-fixed'), null, [
      el('div.q-head', null, [
        el('span.q-badge', { text: 'کیفیت پرونده' }),
        el('span.q-title', { text: title }),
        el('span.q-when', { text: 'ختم: ' + fmt(q.at) })
      ]),
      el('div.q-items', null, q.missing.map(function (m) {
        return item(m.label, m.state, m.fixedAt, function () { onFix(m.key); });
      })),
      el('p.q-note', {
        text: 'این سابقه پاک نمی‌شود: نقصی که بعد از ختم تکمیل شود، با برچسب «تکمیل پس از ختم» همین‌جا می‌ماند.'
      })
    ]);
  }

  function item(label, state, fixedAt, fix) {
    if (state === 'fixed') {
      return el('span.q-item.is-fixed', {
        title: fixedAt ? 'تکمیل در ' + fmt(fixedAt) : 'تکمیل پس از ختم'
      }, [
        el('b', { text: label }),
        el('small', { text: 'تکمیل پس از ختم' + (fixedAt ? ' · ' + fmt(fixedAt) : '') })
      ]);
    }
    return el('span.q-item.is-open', null, [
      el('b', { text: label }),
      el('button.linkish.tiny.q-fix', { type: 'button', text: 'تکمیل', onclick: fix })
    ]);
  }

  /* ------------------------------------------------------ گزارش */
  function tile(label, value, sub, cls) {
    return el('div.q-tile' + (cls ? '.' + cls : ''), null, [
      el('b', { text: value }), el('span', { text: label }),
      sub ? el('small', { text: sub }) : null
    ]);
  }

  function bar(pct, cls) {
    var b = el('span.q-bar' + (cls ? '.' + cls : ''));
    var f = el('span.q-bar-fill');
    f.style.width = Math.max(0, Math.min(100, pct)) + '%';
    b.appendChild(f);
    return b;
  }

  function openFix(app, rec, key) {
    var field = WL.fixField(key);
    app.state.formTab = 'case';
    app.openCase(rec.id);
    if (field) setTimeout(function () { if (app.jumpField) app.jumpField(field); }, 420);
  }

  function render(app, mount) {
    var s = Q.stats(M.scoped());
    var T = s.totals;
    var box = el('div.q-report');

    box.appendChild(el('div.q-intro', null, [
      el('h2', { text: 'کیفیت پرونده‌های مختومه' }),
      el('p.muted', {
        text: 'هر پرونده لحظهٔ مختومه شدن سنجیده می‌شود: کدام مرحله‌های الزامی تاریخ نداشتند. ' +
          'این سابقه با تکمیلِ بعدی پاک نمی‌شود؛ «تکمیل پس از ختم» کنارش ثبت می‌شود.' +
          (s.since ? ' سنجش از ' + fmt(s.since) + '.' : '')
      })
    ]));

    box.appendChild(el('div.q-tiles', null, [
      tile('کامل بسته شد', T.pct == null ? '—' : fa(T.pct) + '٪',
        fa(T.complete) + ' از ' + fa(T.measured) + ' پروندهٔ سنجیده', T.pct != null && T.pct >= 80 ? 'good' : ''),
      tile('نقصِ موقع ختم', fa(T.missing), 'در ' + fa(T.measured - T.complete) + ' پرونده'),
      tile('تکمیل پس از ختم', fa(T.fixed), T.missing ? fa(Math.round(T.fixed * 100 / T.missing)) + '٪ نقص‌ها' : ''),
      tile('هنوز ناقص', fa(T.open), 'برای وقتی که فرصت هست', T.open ? 'warn' : '')
    ]));

    if (s.unmeasured.length) {
      box.appendChild(el('p.q-before', null, [
        el('span', { text: fa(s.unmeasured.length) + ' پروندهٔ مختومه پیش از سنجش کیفیت بسته شده‌اند و در این آمار نیستند — ' }),
        el('button.linkish.tiny', {
          type: 'button', text: 'دیدن در فهرست',
          onclick: function () {
            app.showCases(s.unmeasured.map(function (r) { return r.id; }), 'مختومهٔ پیش از سنجش کیفیت');
          }
        })
      ]));
    }

    if (!T.measured) {
      box.appendChild(el('div.empty-state', null, [
        el('p', { text: 'هنوز پرونده‌ای پس از آغاز سنجش مختومه نشده. از اولین پرونده‌ای که مختومه کنید، آمار اینجا ساخته می‌شود.' })
      ]));
      w.U.clear(mount);
      mount.appendChild(box);
      return;
    }

    var grid = el('div.q-grid');

    grid.appendChild(el('section.q-card', null, [
      el('h3', { text: 'روند، ماه به ماه' }),
      el('p.muted.tiny', { text: 'درصد پرونده‌هایی که در هر ماه کامل بسته شدند.' }),
      el('div.q-rows', null, s.months.map(function (m) {
        return el('div.q-row', null, [
          el('span.q-row-name', { text: monthName(m.key) }),
          bar(m.pct, m.pct >= 80 ? 'good' : (m.pct < 50 ? 'low' : '')),
          el('span.q-row-val', { text: fa(m.pct) + '٪' }),
          el('span.q-row-sub', { text: fa(m.complete) + '/' + fa(m.n) })
        ]);
      }))
    ]));

    grid.appendChild(el('section.q-card', null, [
      el('h3', { text: 'کدام مرحله بیشتر جا می‌افتد' }),
      el('p.muted.tiny', { text: 'از ' + fa(T.measured) + ' پروندهٔ سنجیده، در چندتا این مرحله موقع ختم تاریخ نداشت.' }),
      s.stages.length ? el('div.q-rows', null, s.stages.map(function (st) {
        var pct = Math.round(st.n * 100 / T.measured);
        return el('div.q-row', null, [
          el('span.q-row-name', { text: st.label }),
          bar(pct, 'low'),
          el('span.q-row-val', { text: fa(st.n) }),
          el('span.q-row-sub', { text: st.fixed ? fa(st.fixed) + ' تکمیل' : '' })
        ]);
      })) : el('p.muted', { text: 'هیچ مرحله‌ای جا نیفتاده است. ✓' })
    ]));

    if (s.experts.length > 1) {
      grid.appendChild(el('section.q-card', null, [
        el('h3', { text: 'بر اساس کارشناس' }),
        el('div.q-rows', null, s.experts.map(function (e) {
          return el('div.q-row', null, [
            el('span.q-row-name', { text: e.key }),
            bar(e.pct, e.pct >= 80 ? 'good' : (e.pct < 50 ? 'low' : '')),
            el('span.q-row-val', { text: fa(e.pct) + '٪' }),
            el('span.q-row-sub', { text: fa(e.complete) + '/' + fa(e.n) })
          ]);
        }))
      ]));
    }
    box.appendChild(grid);

    box.appendChild(el('section.q-card.q-pending', null, [
      el('div.q-card-head', null, [
        el('h3', { text: 'مختومه‌هایی که هنوز چیزی برای تکمیل دارند ' + fa(s.pending.length) }),
        el('div.spacer'),
        s.pending.length ? el('button.btn.small.ghost', {
          type: 'button', text: 'نمایش در فهرست',
          onclick: function () {
            app.showCases(s.pending.map(function (x) { return x.rec.id; }), 'مختومهٔ ناقص');
          }
        }) : null
      ]),
      s.pending.length ? el('ul.wl-st-list', null, s.pending.slice(0, 200).map(function (x) {
        return el('li.wl-st-row.is-missing', null, [
          w.UIWorklist.caseNumber(x.rec),
          el('span.wl-st-who', { text: personName(x.rec) }),
          el('span.wl-st-meta', { text: 'ختم: ' + fmt(x.q.at) }),
          el('div.wl-miss-chips', null, x.q.missing.filter(function (m) {
            return m.state === 'open';
          }).map(function (m) {
            return el('button.wl-miss', {
              type: 'button', text: m.label, title: 'تکمیل «' + m.label + '»',
              onclick: function () { openFix(app, x.rec, m.key); }
            });
          }))
        ]);
      })) : el('p.muted', { text: 'چیزی برای تکمیل نمانده است. ✓' })
    ]));

    w.U.clear(mount);
    mount.appendChild(box);
  }

  w.UIQuality = { caseBox: caseBox, render: render };
})(window);
