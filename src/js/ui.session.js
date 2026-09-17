/*
 * صورت‌جلسه: ثبت نتیجهٔ جلسهٔ کمیته، از روی همان دستور کاری که چاپ شده.
 *
 * واقعیتِ کار این است که یک جلسه یک نتیجه ندارد: چند پرونده رأی می‌گیرند،
 * یکی دو تا موکول می‌شوند و یکی اصلاً مطرح نمی‌شود. پس به‌جای «یک مقدار روی
 * همه»، اینجا هر سطر نتیجهٔ خودش را دارد و تاریخ و شمارهٔ جلسه یک بار بالای
 * صفحه وارد می‌شود.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }

  var STATUS_VERDICT = 'رای صادر، ثبت و در انتظارابلاغ رای قرار گرفت';
  var STATUS_AGENDA = 'در دستور کار قرار گرفت';

  /* چهار نتیجهٔ ممکن برای هر پرونده در یک جلسه */
  var OUTCOMES = [
    {
      key: 'verdict', label: 'رأی صادر شد',
      hint: 'تاریخ و شمارهٔ جلسه ثبت می‌شود و پرونده به مرحلهٔ ابلاغ می‌رود.'
    },
    {
      key: 'discussed', label: 'مطرح شد، رأی بعداً',
      hint: 'تاریخ جلسه ثبت می‌شود؛ پرونده در «ثبت متن رأی» می‌ماند.'
    },
    {
      key: 'postponed', label: 'موکول به جلسهٔ بعد',
      hint: 'تاریخی ثبت نمی‌شود؛ فقط یک یادداشت می‌نشیند و پرونده در دستور کار می‌ماند.'
    },
    {
      key: 'absent', label: 'مطرح نشد',
      hint: 'هیچ تغییری نمی‌کند.'
    }
  ];

  var OUTCOME_BY_KEY = {};
  OUTCOMES.forEach(function (o) { OUTCOME_BY_KEY[o.key] = o; });

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  /**
   * پنجرهٔ صورت‌جلسه.
   * cases: پرونده‌های دستور کار · onDone: بعد از ثبت موفق
   */
  function dialog(app, cases, onDone) {
    var head = {
      date: J.today(),
      session: '',
      regNo: ''            // شمارهٔ ثبت دبیرخانهٔ کمیته، اگر برای همه یکی باشد
    };
    var rows = cases.map(function (rec) {
      return { rec: rec, outcome: 'verdict', verdict: '', regNo: '' };
    });

    var body = el('div.minutes');
    var rowsHost = el('div.minutes-rows');
    var summary = el('div.minutes-summary');
    var apply, printBtn, m;

    // ------------------------------------------------------------ سربرگ جلسه
    var dateField = w.DatePicker.field(head.date, function (v) {
      head.date = v;
      refresh();
    });
    var sessionInput = el('input.input.small.reg-input', {
      type: 'text', placeholder: 'مثلاً ۲۱', value: ''
    });
    sessionInput.addEventListener('input', function () {
      head.session = sessionInput.value.trim();
      refresh();
    });
    var regInput = el('input.input.small.reg-input', {
      type: 'text', placeholder: 'اختیاری'
    });
    regInput.addEventListener('input', function () {
      head.regNo = regInput.value.trim();
      refresh();
    });

    body.appendChild(el('div.minutes-head', null, [
      el('label.field', null, [
        el('span.field-label', { text: 'تاریخ جلسه' }), dateField
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'شمارهٔ جلسه' }), sessionInput
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'شمارهٔ ثبت دبیرخانهٔ کمیته' }), regInput
      ])
    ]));

    // ------------------------------------------------------- تعیین گروهی نتیجه
    function setAll(key) {
      rows.forEach(function (r) { r.outcome = key; });
      build();
      refresh();
    }
    body.appendChild(el('div.minutes-all', null, [
      el('span.muted.tiny', { text: 'نتیجهٔ همه:' }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'رأی صادر شد',
        onclick: function () { setAll('verdict'); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'مطرح شد، رأی بعداً',
        onclick: function () { setAll('discussed'); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'مطرح نشد',
        onclick: function () { setAll('absent'); }
      })
    ]));

    body.appendChild(rowsHost);

    // ------------------------------------------------------- افزودن پروندهٔ دیگر
    var addInput = el('input.input.small', {
      type: 'search', placeholder: 'افزودن پرونده‌ای که در دستور کار نبود…'
    });
    var addResults = el('div.minutes-add-results');
    addInput.addEventListener('input', w.U.debounce(function () {
      w.U.clear(addResults);
      var q = addInput.value.trim();
      if (q.length < 2) return;
      var have = {};
      rows.forEach(function (r) { have[r.rec.id] = 1; });
      var found = M.query({ q: q, filters: {} }).filter(function (rec) {
        return !have[rec.id];
      }).slice(0, 6);
      if (!found.length) {
        addResults.appendChild(el('span.muted.tiny', { text: 'پرونده‌ای پیدا نشد.' }));
        return;
      }
      found.forEach(function (rec) {
        addResults.appendChild(el('button.btn.small.ghost', {
          type: 'button',
          onclick: function () {
            rows.push({ rec: rec, outcome: 'verdict', verdict: '', regNo: '' });
            addInput.value = '';
            w.U.clear(addResults);
            build();
            refresh();
          }
        }, [
          el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') }),
          el('span', { text: ' ' + personOf(rec) })
        ]));
      });
    }, 180));

    body.appendChild(el('div.minutes-add', null, [
      el('span.field-label', { text: 'پروندهٔ دیگری هم مطرح شد؟' }),
      addInput, addResults
    ]));
    body.appendChild(summary);

    // ------------------------------------------------------------------ سطرها
    function build() {
      w.U.clear(rowsHost);
      if (!rows.length) {
        rowsHost.appendChild(el('p.muted', { text: 'پرونده‌ای در دستور کار نیست.' }));
        return;
      }
      rows.forEach(function (r, i) {
        var row = el('div.minutes-row.out-' + r.outcome);

        row.appendChild(el('span.minutes-num', { text: fa(i + 1) }));
        row.appendChild(el('div.minutes-who', null, [
          el('span.reg-no', { text: w.U.toLatinDigits(r.rec.caseNo || '—') }),
          el('span.minutes-name', { text: personOf(r.rec) }),
          el('span.minutes-unit', { text: r.rec.orgUnit || '' })
        ]));

        var sel = el('select.input.small.minutes-outcome');
        OUTCOMES.forEach(function (o) {
          sel.appendChild(el('option', { value: o.key, text: o.label }));
        });
        sel.value = r.outcome;
        sel.addEventListener('change', function () {
          r.outcome = sel.value;
          build();
          refresh();
        });
        row.appendChild(sel);

        row.appendChild(el('button.icon-btn.minutes-remove', {
          type: 'button', text: '✕', title: 'برداشتن از صورت‌جلسه',
          onclick: function () {
            rows.splice(i, 1);
            build();
            refresh();
          }
        }));

        // متن رأی فقط برای پرونده‌ای که رأی گرفته معنا دارد
        if (r.outcome === 'verdict') {
          var vt = el('textarea.input.area.minutes-verdict', {
            placeholder: 'متن رأی کمیته (اختیاری — بعداً هم می‌شود نوشت)',
            rows: '2'
          });
          vt.value = r.verdict;
          vt.addEventListener('input', function () { r.verdict = vt.value; });
          row.appendChild(vt);
        }
        if (r.outcome === 'postponed') {
          row.appendChild(el('span.minutes-note', {
            text: 'یادداشت «موکول به جلسهٔ بعد» روی پرونده ثبت می‌شود.'
          }));
        }
        rowsHost.appendChild(row);
      });
    }

    // ----------------------------------------------------------------- شمارش
    function counts() {
      var c = { verdict: 0, discussed: 0, postponed: 0, absent: 0 };
      rows.forEach(function (r) { c[r.outcome] += 1; });
      c.touched = c.verdict + c.discussed;
      return c;
    }

    function ready() {
      return !!(head.date && head.session && counts().touched + counts().postponed > 0);
    }

    function refresh() {
      var c = counts();
      w.U.clear(summary);
      var bits = [];
      if (c.verdict) bits.push(fa(c.verdict) + ' رأی');
      if (c.discussed) bits.push(fa(c.discussed) + ' مطرح‌شده بدون رأی');
      if (c.postponed) bits.push(fa(c.postponed) + ' موکول');
      if (c.absent) bits.push(fa(c.absent) + ' مطرح‌نشده');
      // جداکننده باید عنصر جدا باشد؛ نقطه‌چین وسط ارقام فارسی، دوپهلو خوانده می‌شود
      if (!bits.length) {
        summary.appendChild(el('b', { text: 'هیچ پرونده‌ای' }));
      } else {
        summary.appendChild(el('span.minutes-bits', null, bits.map(function (t) {
          return el('b.minutes-bit', { text: t });
        })));
      }
      if (!head.session) {
        summary.appendChild(el('span.minutes-warn', {
          text: ' — شمارهٔ جلسه را وارد کنید.'
        }));
      } else if (c.touched) {
        summary.appendChild(el('span', {
          text: ' — تاریخ ' + J.format(head.date) + ' و جلسهٔ ' +
            w.U.toFaDigits(head.session) + ' روی ' + fa(c.touched) + ' پرونده ثبت می‌شود.'
        }));
      }
      if (apply) apply.disabled = !ready();
      if (printBtn) printBtn.disabled = !rows.length;
    }

    // ----------------------------------------------------------------- اعمال
    /** تبدیل هر سطر به تغییرِ همان پرونده */
    function patches() {
      var out = [];
      rows.forEach(function (r) {
        if (r.outcome === 'absent' || r.outcome === 'postponed') return;
        var patch = { committeeDate: head.date, session: head.session };
        if (r.outcome === 'verdict') {
          patch.status = STATUS_VERDICT;
          if (r.verdict.trim()) patch.verdictFull = r.verdict.trim();
          var reg = (r.regNo || head.regNo || '').trim();
          if (reg) patch.committeeRegNo = reg;
        } else {
          patch.status = STATUS_AGENDA;
        }
        out.push({ id: r.rec.id, patch: patch });
      });
      return out;
    }

    function save() {
      var c = counts();
      var label = 'صورت‌جلسهٔ ' + w.U.toFaDigits(head.session) +
        ' — ' + J.format(head.date);
      var lines = [];
      if (c.verdict) lines.push(fa(c.verdict) + ' پرونده با رأی');
      if (c.discussed) lines.push(fa(c.discussed) + ' پرونده بدون رأی');
      var text = 'تاریخ جلسه ' + J.format(head.date) + ' و شمارهٔ جلسه ' +
        w.U.toFaDigits(head.session) + ' روی ' + lines.join(' و ') + ' ثبت می‌شود' +
        (c.postponed ? '، و برای ' + fa(c.postponed) +
          ' پروندهٔ موکول‌شده یادداشت گذاشته می‌شود' : '') +
        (c.absent ? '. ' + fa(c.absent) +
          ' پروندهٔ مطرح‌نشده دست‌نخورده می‌ماند' : '') +
        '. ادامه می‌دهید؟';

      return w.U.confirmBox('ثبت صورت‌جلسه', text, 'ثبت کن').then(function (okay) {
        if (!okay) return null;
        apply.disabled = true;
        apply.textContent = 'در حال ثبت…';
        var list = patches();
        var postponed = rows.filter(function (r) { return r.outcome === 'postponed'; });

        return M.applyPatches(list, { kind: 'session', note: label })
          .then(function (res) {
            // موکول‌شده‌ها تاریخی نمی‌گیرند؛ فقط ردشان در یادداشت می‌ماند
            return Promise.all(postponed.map(function (r) {
              return w.Notes.add(r.rec,
                'در جلسهٔ ' + w.U.toFaDigits(head.session) + ' (' +
                J.format(head.date) + ') مطرح و به جلسهٔ بعد موکول شد.', '');
            })).then(function () { return res; });
          })
          .then(function (res) {
            m.close();
            w.U.toast(fa(res.changed) + ' پرونده با صورت‌جلسه به‌روز شد' +
              (postponed.length ? '، ' + fa(postponed.length) + ' پرونده موکول شد' : '') +
              '.', 'good');
            if (onDone) onDone(res);
            return res;
          });
      }).catch(function (e) {
        apply.disabled = false;
        apply.textContent = 'ثبت صورت‌جلسه';
        w.U.toast('ثبت ناموفق بود: ' + e.message, 'bad');
      });
    }

    apply = el('button.btn.primary', {
      type: 'button', text: 'ثبت صورت‌جلسه', onclick: save
    });
    printBtn = el('button.btn.ghost', {
      type: 'button', text: 'چاپ صورت‌جلسه',
      title: 'برگهٔ صورت‌جلسه با همین نتیجه‌ها، برای امضا و بایگانی',
      onclick: function () {
        w.UIPrint.printMinutes({
          date: head.date, session: head.session, regNo: head.regNo
        }, rows.map(function (r) {
          return {
            rec: r.rec, outcome: r.outcome,
            outcomeLabel: OUTCOME_BY_KEY[r.outcome].label, verdict: r.verdict
          };
        }));
      }
    });

    build();
    refresh();

    m = w.U.modal('ثبت نتیجهٔ جلسه', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      printBtn, apply
    ]);
    m.root.classList.add('minutes-modal');
    setTimeout(function () { sessionInput.focus(); }, 60);
    return m;
  }

  w.UISession = { dialog: dialog, OUTCOMES: OUTCOMES };
})(window);
