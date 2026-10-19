/* کارتابل: صفحهٔ نخست — چه کاری شده و چه کاری مانده */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, WL = w.Worklist;

  function fa(n) { return w.U.toFaDigits(n); }

  /** شمارهٔ پرونده مثل یک شمارهٔ ثبت دبیرخانه، با ارقام لاتین و قلم داده */
  function caseNumber(rec) {
    return el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') });
  }

  /* ================================================================
     شمارش معکوسِ مهلت دفاعیه
     ----------------------------------------------------------------
     یک عدد، سه جا: کنار خودِ فیلد در فرم، به‌شکل یک نوارِ متحرک بالای
     پرونده، و به‌شکل یک ساعتِ کوچک در فهرست پرونده‌ها. هر سه از یک
     تابع می‌خوانند (Worklist.defenseWatch) تا سه جا سه حرف نزنند.
     ================================================================ */

  /** «۵ روز تا پایان مهلت» / «امروز آخرین روز» / «۳ روز از مهلت گذشته» */
  function cdText(cd) {
    if (!cd) return '';
    if (cd.left > 0) return fa(cd.left) + ' روز تا پایان مهلت';
    if (cd.left === 0) return 'امروز آخرین روز مهلت است';
    return fa(-cd.left) + ' روز از مهلت گذشته';
  }

  /* کنارِ قرصِ ساعت جا برای جمله نیست: فقط عدد. «+» یعنی از مهلت گذشته.
     جملهٔ کامل در تولتیپِ همان ساعت است. */
  function cdShort(cd) {
    if (!cd) return '';
    if (cd.left > 0) return fa(cd.left);
    if (cd.left === 0) return 'امروز';
    return '+' + fa(-cd.left);
  }

  /**
   * ساعتِ کوچکِ فهرست.
   *
   * در یک سطرِ جدول جا برای جمله نیست، و عددِ تنها هم نمی‌گوید «کم مانده»
   * یا «زیاد». پس یک قرصِ ساعت: هرچه از مهلت گذشته، پُرتر می‌شود؛ عقربه
   * همان‌جاست؛ و وقتی مهلت گذشته باشد قرص سرخ می‌شود و آرام نبض می‌زند.
   */
  function clock(rec) {
    var cd = WL.defenseWatch(rec);
    if (!cd) return null;
    var R = 7, C = 2 * Math.PI * R;
    var gone = C * (cd.pct / 100);
    // عقربه، همان درصد را روی صفحهٔ ساعت نشان می‌دهد
    var ang = (cd.pct / 100) * 2 * Math.PI - Math.PI / 2;
    var hx = 9 + Math.cos(ang) * 4.6, hy = 9 + Math.sin(ang) * 4.6;
    var svg = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">' +
      '<circle class="cl-bg" cx="9" cy="9" r="' + R + '"/>' +
      '<circle class="cl-arc" cx="9" cy="9" r="' + R + '" ' +
      'stroke-dasharray="' + gone.toFixed(2) + ' ' + C.toFixed(2) + '" />' +
      '<line class="cl-hand" x1="9" y1="9" x2="' + hx.toFixed(2) + '" y2="' +
      hy.toFixed(2) + '"/><circle class="cl-pin" cx="9" cy="9" r="1.3"/></svg>';
    return el('span.cd-clock.is-' + cd.state, {
      html: svg,
      title: 'مهلت دفاعیه: ' + J.format(cd.due) + ' — ' + cdText(cd) +
        (cd.chased ? '\nنامهٔ پیگیری رفته است.' : '')
    }, [el('span.cd-clock-n', { text: cdShort(cd) })]);
  }

  /**
   * نوارِ شمارش معکوس، بالای پرونده.
   *
   * خطِ متحرک از صفر تا درصدِ سپری‌شده کشیده می‌شود — حرکت، «در حال
   * گذشتن» را می‌گوید، جوری که عدد نمی‌گوید. وقتی مهلت گذشته باشد خط
   * سرخ می‌شود و نبض می‌زند، و دکمهٔ «نامهٔ پیگیری» کنارش می‌آید: هشدار
   * بدون راهِ انجامِ کار، فقط مزاحمت است.
   */
  function countdown(rec, onChase, onReceive) {
    var cd = WL.defenseWatch(rec);
    if (!cd) return null;
    var fill = el('span.cd-fill');
    var node = el('div.case-next.countdown.is-' + cd.state, null, [
      el('span.case-next-label', null, [
        el('span.cd-icon', { html: w.Mobile.icon('clock') || '' }),
        el('span', { text: 'مهلت دفاعیه' })
      ]),
      el('div.case-next-text', null, [
        el('span.case-next-meta', null, [
          el('b', { text: cdText(cd) }),
          el('span', { text: ' — تا ' + J.format(cd.due, { long: true }) })
        ]),
        el('span.cd-line', null, [fill]),
        el('span.case-next-auto', {
          text: cd.state === 'late'
            ? (cd.chased
              ? 'نامهٔ پیگیری رفته است؛ اگر باز هم نیامد، پرونده بدون دفاعیه به کمیته می‌رود.'
              : 'مهلت تمام شده و دفاعیه‌ای ثبت نشده — وقتِ نامهٔ پیگیری است.')
            : 'از ' + fa(cd.total) + ' روز مهلت، ' + fa(cd.gone) + ' روز گذشته است.'
        })
      ]),
      el('div.spacer'),
      onReceive ? el('button.btn.small.ghost', {
        type: 'button', text: 'دفاعیه رسید',
        title: 'ثبت تاریخ اخذ دفاعیه',
        onclick: onReceive
      }) : null,
      (cd.state === 'late' || cd.state === 'today') && onChase && !cd.chased
        ? el('button.btn.small.primary', {
          type: 'button', text: 'نامهٔ پیگیری',
          title: 'بارگذاری نامهٔ پیگیری دفاعیات',
          onclick: onChase
        }) : null
    ]);
    // خط، بعد از نشستن در صفحه پر می‌شود؛ وگرنه حرکتی دیده نمی‌شود
    setTimeout(function () { fill.style.width = cd.pct + '%'; }, 60);
    return node;
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
     گردش‌کار: کجا هستند، کدام ثبت شده، کدام ناقص است
     ----------------------------------------------------------------
     هر گرهِ ریل، دکمه است. زیرش پنلی باز می‌شود با سه فهرست: پرونده‌هایی
     که الان روی همین مرحله‌اند، آن‌هایی که این مرحله را ثبت کرده‌اند، و
     آن‌هایی که از آن گذشته‌اند بی‌آنکه تاریخش وارد شده باشد («ناقص»).
     هر ناقص یک دکمهٔ «تکمیل» دارد که پرونده را درست سرِ همان فیلد باز
     می‌کند.
     ================================================================ */
  function fixCase(app, rec, stageKey) {
    var field = WL.fixField(stageKey);
    app.state.formTab = 'case';
    app.openCase(rec.id);
    if (field) setTimeout(function () { if (app.jumpField) app.jumpField(field); }, 420);
  }

  function personName(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بی‌نام';
  }

  function stageRow(app, rec, stage, mode) {
    var a = WL.nextAction(rec);
    var date = '';
    if (mode === 'recorded') {
      var st = WL.STAGES.filter(function (x) { return x.key === stage.key; })[0];
      var d = st && rec[st.field];
      date = d && J.unpack(d) ? J.format(d) : (d || '');
    }
    return el('li.wl-st-row' + (mode === 'missing' ? '.is-missing' : ''), null, [
      caseNumber(rec),
      el('span.wl-st-who', { text: personName(rec) }),
      el('span.wl-st-meta', {
        text: mode === 'recorded' ? (date ? 'ثبت: ' + date : 'ثبت شده')
          : (a && a.label ? a.label : (rec.status || ''))
      }),
      el('div.spacer'),
      mode === 'missing' ? el('button.btn.small.wl-fix', {
        type: 'button', text: 'تکمیل ←',
        title: 'پرونده درست سرِ فیلدِ «' + stage.label + '» باز می‌شود',
        onclick: function () { fixCase(app, rec, stage.key); }
      }) : el('button.linkish.tiny', {
        type: 'button', text: 'باز کردن',
        onclick: function () { app.openCase(rec.id); }
      })
    ]);
  }

  function pipelineCard(app, cases) {
    var st = app.state;
    // ارجاع‌شده به کارشناس دیگر، دیگر کارِ ما نیست: در آمار و ناقص‌ها نمی‌آید
    var moved = cases.filter(WL.isTransferred);
    cases = cases.filter(function (c) { return !WL.isTransferred(c); });
    var detail = WL.pipelineDetail(cases);
    var inc = WL.incomplete(cases);
    var total = cases.length || 1;
    var pick = st.wlStage || '';

    var rail = el('ol.rail.rail-pipe.rail-pick');
    detail.forEach(function (d, i) {
      var pct = Math.round((d.passed / total) * 100);
      var on = pick === d.key;
      rail.appendChild(el('li.rail-step' + (d.passed ? '.done' : '') + (i === 0 ? '.first' : '') +
        (on ? '.picked' : ''), null, [
        el('button.rail-hit', {
          type: 'button',
          title: d.label + ' — ' + fa(d.passed) + ' پرونده (' + fa(pct) + '٪)' +
            (d.here.length ? '، ' + fa(d.here.length) + ' پرونده الان اینجا' : '') +
            (d.missing.length ? '، ' + fa(d.missing.length) + ' ناقص' : ''),
          'aria-pressed': on ? 'true' : 'false',
          onclick: function () { st.wlStage = on ? '' : d.key; st.wlIncomplete = false; app.render(); }
        }, [
          el('span.rail-dot'),
          el('span.rail-count', { text: fa(d.passed) }),
          el('span.rail-name', { text: d.short }),
          d.missing.length ? el('span.rail-miss', { text: fa(d.missing.length), title: 'ناقص' }) : null,
          d.here.length ? el('span.rail-here', { text: fa(d.here.length) + ' اینجا' }) : null
        ])
      ]));
    });

    var head = el('div.wl-section-head', null, [
      el('h2', { text: 'گردش‌کار' }),
      el('p.wl-sub', { text: 'روی هر مرحله بزنید: چه کسانی اینجا هستند، کدام ثبت شده و کدام ناقص است.' }),
      moved.length ? el('button.linkish.tiny.wl-moved', {
        type: 'button',
        text: fa(moved.length) + ' پروندهٔ ارجاع‌شده به کارشناس دیگر در این آمار نیست',
        title: 'دیدن این پرونده‌ها در فهرست',
        onclick: function () {
          app.showCases(moved.map(function (c) { return c.id; }), 'ارجاع‌شده به کارشناس دیگر');
        }
      }) : null,
      // نقصِ مختومه‌ها اینجا نیست؛ راهش گفته می‌شود
      cases.some(WL.isClosed) ? el('button.linkish.tiny.wl-moved.wl-to-quality', {
        type: 'button', text: 'نقصِ پرونده‌های مختومه: گزارش‌ها ← کیفیت پرونده‌ها',
        onclick: function () { app.state.reportTab = 'quality'; app.goReport(); }
      }) : null
    ]);

    var nodes = [head];
    if (inc.length) {
      nodes.push(el('button.wl-inc-bar' + (st.wlIncomplete ? '.on' : ''), {
        type: 'button',
        onclick: function () { st.wlIncomplete = !st.wlIncomplete; st.wlStage = ''; app.render(); }
      }, [
        el('span.wl-inc-n', { text: fa(inc.length) }),
        el('span', { text: 'پروندهٔ در جریان اطلاعاتِ ناقص دارند — از مرحله‌ای گذشته‌اند که تاریخش وارد نشده.' }),
        el('div.spacer'),
        el('span.wl-inc-go', { text: st.wlIncomplete ? 'بستن' : 'دیدن و تکمیل ←' })
      ]));
    }
    nodes.push(rail);

    if (st.wlIncomplete && inc.length) {
      /* فقط پرونده‌های در جریان: نقصِ مختومه‌ها کار نیست، سابقهٔ کیفیت
         است — در خودِ پرونده و در «گزارش‌ها ← کیفیت پرونده‌ها» می‌ماند. */
      var shown = inc;
      nodes.push(el('div.wl-st-panel', null, [
        el('div.wl-st-head', null, [
          el('h3', { text: 'پرونده‌های ناقصِ در جریان ' + fa(shown.length) }),
          el('span.muted.tiny', { text: 'روی هر کمبود بزنید تا پرونده سرِ همان فیلد باز شود.' }),
          el('div.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: 'نمایش در فهرست',
            onclick: function () {
              app.showCases(shown.map(function (x) { return x.rec.id; }), 'پرونده‌های ناقص');
            }
          })
        ]),
        el('ul.wl-st-list', null, shown.slice(0, st.wlIncAll ? 500 : 30).map(function (x) {
          return el('li.wl-st-row.is-missing', null, [
            caseNumber(x.rec),
            el('span.wl-st-who', { text: personName(x.rec) }),
            el('div.wl-miss-chips', null, x.missing.map(function (m) {
              return el('button.wl-miss', {
                type: 'button', text: m.short, title: 'تکمیل «' + m.label + '»',
                onclick: function () { fixCase(app, x.rec, m.key); }
              });
            }))
          ]);
        })),
        shown.length > 30 && !st.wlIncAll ? el('button.btn.small.ghost', {
          type: 'button', text: 'همهٔ ' + fa(shown.length) + ' پرونده',
          onclick: function () { st.wlIncAll = true; app.render(); }
        }) : null
      ]));
    } else if (pick) {
      var d = detail.filter(function (x) { return x.key === pick; })[0];
      if (d) {
        var tabs = [
          { k: 'here', t: 'الان در این مرحله', list: d.here },
          { k: 'missing', t: 'ناقص', list: d.missing },
          { k: 'recorded', t: 'ثبت‌شده', list: d.recorded }
        ];
        var tab = st.wlStageTab;
        if (!tab || !tabs.filter(function (x) { return x.k === tab; })[0].list.length) {
          tab = d.missing.length ? 'missing' : (d.here.length ? 'here' : 'recorded');
        }
        var cur = tabs.filter(function (x) { return x.k === tab; })[0];
        nodes.push(el('div.wl-st-panel', null, [
          el('div.wl-st-head', null, [
            el('h3', { text: d.label }),
            d.optional ? el('span.wl-st-opt', { text: 'اختیاری' }) : null,
            el('div.wl-st-tabs', { role: 'tablist' }, tabs.map(function (x) {
              return el('button.wl-st-tab' + (x.k === tab ? '.on' : '') + (x.k === 'missing' && x.list.length ? '.warn' : ''), {
                type: 'button', role: 'tab', disabled: !x.list.length,
                text: x.t + ' ' + fa(x.list.length),
                onclick: function () { st.wlStageTab = x.k; app.render(); }
              });
            })),
            el('div.spacer'),
            cur.list.length ? el('button.btn.small.ghost', {
              type: 'button', text: 'نمایش در فهرست',
              onclick: function () {
                app.showCases(cur.list.map(function (r) { return r.id; }), d.label + ' — ' + cur.t);
              }
            }) : null,
            el('button.fdrawer-x', {
              type: 'button', text: '✕', title: 'بستن',
              onclick: function () { st.wlStage = ''; app.render(); }
            })
          ]),
          tab === 'missing' ? el('p.wl-st-note', {
            text: 'این پرونده‌ها از «' + d.label + '» گذشته‌اند ولی تاریخش ثبت نشده. «تکمیل» پرونده را سرِ همان فیلد باز می‌کند.'
          }) : null,
          cur.list.length ? el('ul.wl-st-list', null, cur.list.slice(0, 80).map(function (rec) {
            return stageRow(app, rec, d, tab);
          })) : el('p.muted.tiny', { text: 'پرونده‌ای نیست.' }),
          cur.list.length > 80 ? el('p.muted.tiny', {
            text: 'و ' + fa(cur.list.length - 80) + ' پروندهٔ دیگر — «نمایش در فهرست» همه را می‌آورد.'
          }) : null
        ]));
      }
    }
    return el('section.wl-section.wl-pipe-card', inc.length
      ? { 'data-badge': fa(inc.length) + ' ناقص', 'data-late': '1' } : null, nodes);
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

    return el('section.wl-section.week-card', deadlines + follows
      ? { 'data-badge': fa(deadlines + follows) + ' سررسید' } : null, [
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
      /* ساعتِ مهلت دفاعیه، کنار روزشمار — همان قرصی که در فهرست
         پرونده‌ها هم هست، تا دو جا یک زبان داشته باشند. */
      el('span.wl-wait' + (action.overdue ? '.late' : ''), {
        title: action.limit
          ? 'مهلت ' + fa(action.limit) + ' روز' : 'بدون مهلت تعریف‌شده'
      }, [clock(rec), el('span', { text: wait })]),
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

    var box = el('details.wl-today-log', { 'data-n': n }, [
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
  /* ================================================================
     چیدمانِ کارتابل
     ----------------------------------------------------------------
     هر بخش یک کارت است، با پس‌زمینه و قابِ خودش. ترتیبشان سلیقهٔ خودِ
     کاربر است: از «چیدمان کارتابل»، یا با کشیدنِ دستگیرهٔ هر کارت. هر
     بخش جمع هم می‌شود، و هر کدام را می‌شود پنهان کرد. همه در تنظیماتِ
     دیتابیس می‌ماند.
     ================================================================ */
  var SECTIONS = [
    { key: 'follow', label: 'قرارهای پیگیری', hint: 'قرارهایی که خودتان روی پرونده‌ها گذاشته‌اید' },
    { key: 'tasks', label: 'کارهای امروز', hint: 'کارهایی که سررسیدشان رسیده' },
    { key: 'done', label: 'انجام‌شدهٔ امروز', hint: 'نامه، سند و کارِ امروز' },
    { key: 'week', label: 'این هفته', hint: 'سررسیدهای هفت روز آینده' },
    { key: 'pipeline', label: 'گردش‌کار', hint: 'مرحله‌ها، و پرونده‌های ناقص' },
    { key: 'ours', label: 'منتظر اقدام ما', hint: 'کاری که با دبیرخانه است' },
    { key: 'ready', label: 'آمادهٔ طرح در جلسه', hint: 'دفاعیه گرفته شده، آمادهٔ دستور کار' },
    { key: 'theirs', label: 'منتظر دیگران', hint: 'توپ در زمین دیگران است' }
  ];

  function layout() {
    var saved = (M.state.settings || {}).worklistLayout || {};
    var known = SECTIONS.map(function (x) { return x.key; });
    var order = (saved.order || []).filter(function (k) { return known.indexOf(k) >= 0; });
    // بخشِ تازه‌ای که در ترتیبِ ذخیره‌شده نیست، سرِ جای پیش‌فرضش می‌نشیند
    known.forEach(function (k, i) {
      if (order.indexOf(k) >= 0) return;
      var before = known.slice(0, i).filter(function (x) { return order.indexOf(x) >= 0; });
      var at = before.length ? order.indexOf(before[before.length - 1]) + 1 : 0;
      order.splice(at, 0, k);
    });
    return {
      order: order, hidden: saved.hidden || {}, collapsed: saved.collapsed || {},
      // آکاردئونی: پیش‌فرض روشن — یک بخش باز، بقیه فقط سرتیتر با شمارش
      accordion: saved.accordion !== false,
      open: saved.open == null ? null : saved.open
    };
  }

  function saveLayout(patch) {
    var cur = layout();
    return M.saveSettings({ worklistLayout: Object.assign({}, cur, patch) });
  }

  /** شمارِ خلاصه روی سرتیترِ بخش — وقتی بخش جمع است، همین دیده می‌شود */
  function badge(node, text, late) {
    if (!node || !text) return;
    node.setAttribute('data-badge', text);
    if (late) node.setAttribute('data-late', '1');
  }

  function bucketBadge(node, buckets) {
    var n = 0, late = 0;
    buckets.forEach(function (b) { n += b.items.length; late += b.overdue || 0; });
    badge(node, late ? fa(late) + ' دیرکرد از ' + fa(n) : fa(n) + ' پرونده', late > 0);
  }

  /** کدام بخش‌ها بازند؟ آکاردئونی: فقط یکی (یا هیچ‌کدام)؛ آزاد: هرچه کاربر گذاشته */
  function openSet(L, keys) {
    var open = {};
    if (L.accordion) {
      var k = L.open;
      if (k == null || (k !== '' && keys.indexOf(k) < 0)) k = keys[0] || '';
      if (k) open[k] = true;
    } else {
      keys.forEach(function (x) { if (!L.collapsed[x]) open[x] = true; });
    }
    return open;
  }

  /*
   * کارت‌ها به ترتیبِ کاربر، با دستگیره، و آکاردئونی.
   *
   * کلیک روی هر جای سرتیتر (جز دکمه‌ها و پیوندهای خودش) بخش را باز و بسته
   * می‌کند. این کار در همان صفحه انجام می‌شود، بی‌رندرِ دوباره — پس جای
   * اسکرول و هرچه باز است (دسته‌ها، مرحلهٔ انتخاب‌شده) به هم نمی‌خورد.
   */
  function arrange(app, parts) {
    var L = layout();
    var keys = L.order.filter(function (k) { return parts[k] && !L.hidden[k]; });
    var open = openSet(L, keys);
    var cards = [];

    function setOpen(node, on, animate) {
      node.classList.toggle('is-collapsed', !on);
      var head = node.querySelector('.wl-section-head');
      if (head) head.setAttribute('aria-expanded', on ? 'true' : 'false');
      var fold = node.querySelector('.wl-fold');
      if (fold) fold.title = on ? 'جمع کردن' : 'باز کردن';
      if (on && animate && !w.U.reducedMotion()) {
        node.classList.remove('is-opening');
        void node.offsetWidth;
        node.classList.add('is-opening');
        setTimeout(function () { node.classList.remove('is-opening'); }, 420);
      }
    }

    function persist() {
      var L2 = layout();
      if (L2.accordion) {
        var o = cards.filter(function (c) { return !c.classList.contains('is-collapsed'); })[0];
        return saveLayout({ open: o ? o.getAttribute('data-sec') : '' });
      }
      var c = {};
      cards.forEach(function (n) {
        if (n.classList.contains('is-collapsed')) c[n.getAttribute('data-sec')] = true;
      });
      return saveLayout({ collapsed: c });
    }

    function toggle(node) {
      var on = node.classList.contains('is-collapsed');
      var head = node.querySelector('.wl-section-head');
      var top = head ? head.getBoundingClientRect().top : 0;
      if (on && layout().accordion) {
        cards.forEach(function (c) { if (c !== node) setOpen(c, false); });
      }
      setOpen(node, on, true);
      // بستنِ بخشِ بالایی سرتیترِ این بخش را جابه‌جا می‌کند؛ همان‌جا نگهش دار
      if (head) {
        var shift = head.getBoundingClientRect().top - top;
        if (Math.abs(shift) > 2) w.scrollBy(0, shift);
      }
      persist();
    }

    keys.forEach(function (key) {
      var node = parts[key];
      node.classList.add('wl-card');
      node.setAttribute('data-sec', key);
      var head = node.querySelector('.wl-section-head');
      if (head) {
        head.classList.add('wl-acc-head');
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.insertBefore(el('span.wl-grip', {
          draggable: 'true', title: 'برای جابه‌جایی بکشید', 'aria-hidden': 'true'
        }), head.firstChild);
        var text = node.getAttribute('data-badge');
        if (text && !head.querySelector('.wl-count')) {
          var h2 = head.querySelector('h2');
          var b = el('span.wl-acc-n' + (node.getAttribute('data-late') ? '.late' : ''), { text: text });
          if (h2 && h2.nextSibling) head.insertBefore(b, h2.nextSibling); else head.appendChild(b);
        }
        head.appendChild(el('span.wl-fold', { 'aria-hidden': 'true' }));
        head.addEventListener('click', function (e) {
          // دکمه‌ها، پیوندها و دستگیرهٔ خودِ سرتیتر کارِ خودشان را می‌کنند
          if (e.target.closest('button, a, input, select, textarea, label, .wl-grip')) return;
          toggle(node);
        });
        head.addEventListener('keydown', function (e) {
          if (e.target !== head) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(node); }
        });
      }
      setOpen(node, !!open[key], false);
      dragCard(app, node, key);
      cards.push(node);
    });

    var out = [];
    if (cards.length > 1) out.push(accordionBar(app, cards, setOpen, persist));
    out = out.concat(cards);
    var hidden = L.order.filter(function (k) { return L.hidden[k] && parts[k]; });
    if (hidden.length) {
      out.push(el('p.wl-hidden-note', null, [
        el('span', { text: fa(hidden.length) + ' بخشِ پنهان: ' + hidden.map(function (k) {
          return SECTIONS.filter(function (x) { return x.key === k; })[0].label;
        }).join('، ') + ' — ' }),
        el('button.linkish.tiny', {
          type: 'button', text: 'چیدمان کارتابل',
          onclick: function () { layoutDialog(app); }
        })
      ]));
    }
    return out;
  }

  /** نوار بالای بخش‌ها: یکی‌یکی یا آزاد، و باز/بستنِ همه */
  function accordionBar(app, cards, setOpen, persist) {
    var acc = layout().accordion;
    function mode(on) {
      if (on === layout().accordion) return;
      // هرچه الان باز است، در حالتِ تازه هم باز می‌ماند (در یکی‌یکی: اولی‌اش)
      var opened = cards.filter(function (c) { return !c.classList.contains('is-collapsed'); });
      var collapsed = {};
      cards.forEach(function (c) {
        if (opened.indexOf(c) < 0) collapsed[c.getAttribute('data-sec')] = true;
      });
      saveLayout({
        accordion: on, collapsed: collapsed,
        open: opened.length ? opened[0].getAttribute('data-sec') : ''
      }).then(function () { app.render(); });
    }
    function all(on) {
      if (on && layout().accordion) {
        // «باز کردن همه» با یکی‌یکی جور نیست: به حالت آزاد می‌رویم
        saveLayout({ accordion: false, collapsed: {} }).then(function () {
          app.render();
          w.U.toast('همهٔ بخش‌ها باز شد؛ حالت «آزاد» روشن است.', 'good');
        });
        return;
      }
      cards.forEach(function (c) { setOpen(c, on, on); });
      persist();
    }
    return el('div.wl-acc-bar', null, [
      el('div.wl-acc-seg', { role: 'group', 'aria-label': 'شیوهٔ باز شدن بخش‌ها' }, [
        el('button.wl-acc-opt' + (acc ? '.on' : ''), {
          type: 'button', text: 'یکی‌یکی', 'aria-pressed': acc ? 'true' : 'false',
          title: 'آکاردئونی: با باز کردن یک بخش، بقیه جمع می‌شوند',
          onclick: function () { mode(true); }
        }),
        el('button.wl-acc-opt' + (!acc ? '.on' : ''), {
          type: 'button', text: 'آزاد', 'aria-pressed': !acc ? 'true' : 'false',
          title: 'هر بخش جدا باز و بسته می‌شود',
          onclick: function () { mode(false); }
        })
      ]),
      el('span.wl-acc-hint', { text: 'روی سرتیترِ هر بخش بزنید تا باز یا جمع شود.' }),
      el('div.spacer'),
      el('button.linkish.tiny.wl-acc-all', {
        type: 'button', text: 'باز کردن همه', onclick: function () { all(true); }
      }),
      el('button.linkish.tiny.wl-acc-none', {
        type: 'button', text: 'بستن همه', onclick: function () { all(false); }
      })
    ]);
  }

  /** کشیدنِ کارت با دستگیره‌اش، و رها کردن روی کارتِ دیگر */
  function dragCard(app, node, key) {
    var grip = node.querySelector('.wl-grip');
    if (grip) {
      grip.addEventListener('dragstart', function (e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'wl:' + key);
        try { e.dataTransfer.setDragImage(node, 40, 20); } catch (x) { /* بعضی مرورگرها */ }
        node.classList.add('is-dragging');
      });
      grip.addEventListener('dragend', function () {
        node.classList.remove('is-dragging');
        w.U.$$('.wl-card.drop-before, .wl-card.drop-after').forEach(function (n) {
          n.classList.remove('drop-before', 'drop-after');
        });
      });
    }
    node.addEventListener('dragover', function (e) {
      if (!e.dataTransfer.types || [].indexOf.call(e.dataTransfer.types, 'text/plain') < 0) return;
      e.preventDefault();
      var r = node.getBoundingClientRect();
      var before = e.clientY < r.top + r.height / 2;
      node.classList.toggle('drop-before', before);
      node.classList.toggle('drop-after', !before);
    });
    node.addEventListener('dragleave', function (e) {
      if (e.target === node) node.classList.remove('drop-before', 'drop-after');
    });
    node.addEventListener('drop', function (e) {
      var data = e.dataTransfer.getData('text/plain') || '';
      if (data.indexOf('wl:') !== 0) return;
      e.preventDefault();
      var from = data.slice(3);
      var before = node.classList.contains('drop-before');
      node.classList.remove('drop-before', 'drop-after');
      if (from === key) return;
      moveSection(app, from, key, before);
    });
  }

  function moveSection(app, from, to, before) {
    var order = layout().order.filter(function (k) { return k !== from; });
    var at = order.indexOf(to);
    if (at < 0) return Promise.resolve();
    order.splice(before ? at : at + 1, 0, from);
    return saveLayout({ order: order }).then(function () { app.render(); });
  }

  /** پنجرهٔ چیدمان: ترتیب با ↑↓، دیده شدن با تیک */
  function layoutDialog(app) {
    var L = layout();
    var order = L.order.slice(), hidden = Object.assign({}, L.hidden);
    var list = el('ol.cols-order.wl-lay-list');
    function draw() {
      w.U.clear(list);
      order.forEach(function (k, i) {
        var sec = SECTIONS.filter(function (x) { return x.key === k; })[0];
        var box = el('input', { type: 'checkbox' });
        box.checked = !hidden[k];
        box.addEventListener('change', function () {
          if (box.checked) delete hidden[k]; else hidden[k] = true;
          draw();
        });
        var li = el('li.cols-item' + (hidden[k] ? '.is-off' : ''), { draggable: 'true' }, [
          el('span.cols-grip', { text: '⋮⋮', 'aria-hidden': 'true' }),
          el('span.cols-n', { text: fa(i + 1) }),
          el('label.wl-lay-name', null, [box, el('span', null, [
            el('b', { text: sec.label }), el('small', { text: sec.hint })
          ])]),
          el('button.cols-mv', { type: 'button', text: '↑', title: 'بالاتر', disabled: i === 0,
            onclick: function () { mv(i, i - 1); } }),
          el('button.cols-mv', { type: 'button', text: '↓', title: 'پایین‌تر', disabled: i === order.length - 1,
            onclick: function () { mv(i, i + 1); } })
        ]);
        li.addEventListener('dragstart', function (e) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', k);
          li.classList.add('is-dragging');
        });
        li.addEventListener('dragend', function () { li.classList.remove('is-dragging'); });
        li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('drop'); });
        li.addEventListener('dragleave', function () { li.classList.remove('drop'); });
        li.addEventListener('drop', function (e) {
          e.preventDefault();
          li.classList.remove('drop');
          var from = order.indexOf(e.dataTransfer.getData('text/plain'));
          if (from >= 0) mv(from, i);
        });
        list.appendChild(li);
      });
    }
    function mv(a, b) {
      if (b < 0 || b >= order.length || a === b) return;
      var k = order.splice(a, 1)[0];
      order.splice(b, 0, k);
      draw();
    }
    draw();
    var m = w.U.modal('چیدمان کارتابل', el('div.wl-lay', null, [
      el('p.muted', {
        text: 'بخش‌ها به همین ترتیب، از بالا به پایین، در کارتابل می‌آیند. تیک را بردارید تا ' +
          'بخشی پنهان شود. روی خودِ کارتابل هم می‌شود هر کارت را با دستگیره‌اش کشید.'
      }),
      list
    ]), [
      el('button.btn.ghost', {
        type: 'button', text: 'بازگشت به پیش‌فرض',
        onclick: function () {
          M.saveSettings({ worklistLayout: {} }).then(function () { m.close(); app.render(); });
        }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیره',
        onclick: function () {
          saveLayout({ order: order, hidden: hidden }).then(function () {
            m.close(); app.render();
            w.U.toast('چیدمان کارتابل ذخیره شد.', 'good');
          });
        }
      })
    ]);
    m.root.classList.add('wl-lay-modal');
    return m;
  }

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
      }) : null,
      el('button.btn.small.ghost.wl-layout-btn', {
        type: 'button', text: 'چیدمان کارتابل',
        title: 'ترتیب بخش‌ها، و اینکه کدام دیده شوند',
        onclick: function () { layoutDialog(app); }
      })
    ]);

    var parts = {};

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
      parts.follow = el('section.wl-section.follow-section', null, [
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
      ]);
    }

    /* کارهای امروز، بلافاصله بعد از قرارهای پیگیری: هر دو «قرارِ خودِ
       کاربر»اند، نه حدسِ برنامه، و با هم یک تصویر از امروز می‌دهند. */
    parts.tasks = w.UITasks.todaySection(app);

    var doneToday = todayLog(app);
    if (doneToday) {
      parts.done = el('section.wl-section.done-card', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'انجام‌شدهٔ امروز' }),
          el('p.wl-sub', { text: 'نامه، سند، کار و پرونده‌هایی که امروز جلو رفتند.' })
        ]),
        doneToday
      ]);
      badge(parts.done, fa(doneToday.getAttribute('data-n')) + ' مورد');
    }

    parts.week = weekStrip(app, cases);

    parts.pipeline = pipelineCard(app, cases);

    if (ours.length) {
      parts.ours = el('section.wl-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'منتظر اقدام ما' }),
          el('p.wl-sub', { text: 'کاری که تا انجامش ندهیم، پرونده تکان نمی‌خورد.' })
        ]),
        el('div', null, ours.map(function (b) { return bucketBlock(app, b); }))
      ]);
      bucketBadge(parts.ours, ours);
    }

    if (ready.length) {
      parts.ready = el('section.wl-section', null, [
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
      ]);
      badge(parts.ready, fa(ready.length) + ' پرونده');
    }

    if (theirs.length) {
      parts.theirs = el('section.wl-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'منتظر دیگران' }),
          el('p.wl-sub', { text: 'توپ در زمین ما نیست؛ ولی دیرکردش را باید پیگیری کرد.' })
        ]),
        el('div', null, theirs.map(function (b) { return bucketBlock(app, b); }))
      ]);
      bucketBadge(parts.theirs, theirs);
    }

    var sections = arrange(app, parts);

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
       باید خوانده شود. با «انیمیشن‌ها: خاموش» در تنظیمات کلاً خاموش است. */
    sections.forEach(function (node, i) {
      if (node && node.style) node.style.setProperty('--i', i);
    });

    w.U.clear(mount);
    mount.appendChild(el('div.worklist', null,
      [w.UIScope.banner(app), hero].concat(sections)));
  }

  w.UIWorklist = { render: render, rail: rail, pipelineRail: pipelineRail,
    SECTIONS: SECTIONS, layout: layout, moveSection: moveSection, layoutDialog: layoutDialog,
    caseNumber: caseNumber, weekStrip: weekStrip,
    countdown: countdown, clock: clock, cdText: cdText, cdShort: cdShort };
})(window);
