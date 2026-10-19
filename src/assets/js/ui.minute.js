/*
 * پنجرهٔ «مینوت نامه».
 *
 * سمتِ راست، کلیدها: نوع نامه، گیرنده، نامهٔ مرجع، و چند گزینهٔ خاصِ همان
 * نوع. سمتِ چپ، متنِ آماده — که با هر کلید همان لحظه از نو ساخته می‌شود.
 *
 * متن ویرایش‌پذیر است. ولی اگر دستش بزنید، دیگر خودکار بازسازی نمی‌شود
 * (وگرنه با زدن یک کلید، نوشتهٔ شما می‌پرید)؛ دکمهٔ «ساختن دوباره» برش
 * می‌گرداند.
 *
 * مینوت جزو کارهاست: اولین کپی، چاپ یا ورد در تاریخچهٔ پرونده ثبت می‌شود
 * و از آنجا به کارنامه و خروجی کارکرد روزانه می‌رسد. شمارهٔ نامه که در
 * اتوماسیون گرفته شد، همین‌جا در پرونده می‌نشیند و گردش‌کار جلو می‌رود.
 */
(function (w) {
  'use strict';

  var el = w.U.el, M = w.Model, J = w.J, MN = w.Minute;

  function fa(n) { return w.U.toFaDigits(n); }
  function fmt(d) { return d && J.unpack(d) ? J.format(d) : ''; }

  function copy(text, okMsg) { return w.U.copy(text, okMsg); }

  function check(label, on, onChange, title) {
    var box = el('input', { type: 'checkbox' });
    box.checked = !!on;
    box.addEventListener('change', function () { onChange(box.checked); });
    return el('label.mn-check', { title: title || '' }, [box, el('span', { text: label })]);
  }

  function row(label, node, hint) {
    return el('label.field.mn-field', null, [
      el('span.field-label', { text: label }), node,
      hint ? el('span.mn-hint', { text: hint }) : null
    ]);
  }

  function text(value, onInput, ph) {
    var i = el('input.input.small', { type: 'text', value: value || '', placeholder: ph || '' });
    i.addEventListener('input', function () { onInput(i.value); });
    return i;
  }

  function dateIn(value, onChange) {
    return w.DatePicker.field(value || '', onChange);
  }

  /* --------------------------------------------------------- پنجره */
  /**
   * open(app, recs, opts)
   *   recs: یک یا چند پرونده (نامه معمولاً یک نفر است؛ گاهی چند نفر)
   *   opts.type: نوع پیش‌فرض
   */
  function open(app, recs, startOpts) {
    recs = (recs || []).filter(Boolean);
    if (!recs.length) { w.U.toast('اول پرونده را ذخیره کنید.', 'warn'); return null; }
    startOpts = startOpts || {};

    var st = {
      type: startOpts.type || 'invite',
      recs: recs.slice(),
      recipientId: MN.suggestRecipient(recs[0]).id,
      ref: { source: 'case', relation: 'auto', copy: false },
      confidential: false,
      withName: true,
      opts: {},
      edited: false,
      logged: {}
    };
    var result = null;

    var controls = el('div.mn-controls');
    var paper = el('div.mn-paper');
    var headBox = el('div.mn-head');
    var bodyArea = el('textarea.input.mn-body', { rows: 14, dir: 'rtl', spellcheck: false });
    var rebuildBtn = el('button.linkish.tiny.mn-rebuild', {
      type: 'button', text: 'ساختن دوباره از روی تنظیمات',
      onclick: function () { st.edited = false; render(); }
    });
    rebuildBtn.style.display = 'none';
    // غلط‌یاب زیرِ متن؛ پیش از چاپ و کپی هم می‌پرسد
    var spellBox = w.UISpell ? w.UISpell.attach(bodyArea, { delay: 120 }) : null;
    function checked(action, fn) {
      return function () {
        (w.UISpell ? w.UISpell.guard(bodyArea, action) : Promise.resolve(true))
          .then(function (ok) { if (ok) fn(); });
      };
    }
    bodyArea.addEventListener('input', function () {
      st.edited = true;
      rebuildBtn.style.display = '';
      var missing = bodyArea.value.indexOf(MN.BLANK) >= 0;
      warnLine.style.display = missing ? '' : 'none';
    });

    function recipient() {
      // گیرنده‌ای که مستقیم از «دفتر مقامات» انتخاب شده
      if (String(st.recipientId).indexOf('off:') === 0 && w.Officials) {
        var o = w.Officials.get(st.recipientId.slice(4));
        if (o) return w.Officials.asRecipient(o);
      }
      var list = MN.conf().recipients;
      return list.filter(function (r) { return r.id === st.recipientId; })[0] || list[0];
    }

    function current() {
      return MN.build(st.type, st.recs, {
        recipient: recipient(), ref: st.ref, confidential: st.confidential, opts: st.opts,
        withName: st.withName
      });
    }

    /** گزینه‌های خاصِ نوع، از پیش‌فرض‌های همان نوع برای پرونده */
    function resetOpts() {
      st.opts = MN.typeOf(st.type).defaults(st.recs[0], MN.conf());
      st.edited = false;
    }

    /* ------------------------------------------------------ کلیدها */
    function drawControls() {
      w.U.clear(controls);

      // نوع نامه
      controls.appendChild(el('div.mn-types', { role: 'tablist' }, MN.TYPES.map(function (t) {
        return el('button.mn-type' + (t.key === st.type ? '.on' : ''), {
          type: 'button', text: t.label, role: 'tab',
          onclick: function () {
            if (t.key === st.type) return;
            function go() { st.type = t.key; resetOpts(); drawControls(); render(); }
            // نوعِ دیگر یعنی نامهٔ دیگر؛ ولی دست‌نوشته بی‌پرسش دور ریخته نمی‌شود
            if (!st.edited) { go(); return; }
            w.U.confirmBox('نوع نامه عوض شود؟',
              'متنی که دستی تغییر داده‌اید کنار گذاشته می‌شود و متنِ ' + t.label +
              ' از نو ساخته می‌شود.', 'عوض کن').then(function (ok) { if (ok) go(); });
          }
        });
      })));

      // افراد
      var ppl = el('div.mn-people');
      st.recs.forEach(function (r, i) {
        ppl.appendChild(el('span.mn-person', null, [
          el('span', { text: [r.firstName, r.lastName].filter(Boolean).join(' ') || '—' }),
          el('span.reg-no', { text: w.U.toLatinDigits(r.caseNo || '') }),
          st.recs.length > 1 ? el('button.mn-x', {
            type: 'button', text: '✕', title: 'برداشتن از نامه',
            onclick: function () { st.recs.splice(i, 1); drawControls(); render(); }
          }) : null
        ]));
      });
      var listId = 'mn-cases-' + Math.random().toString(36).slice(2, 7);
      var add = el('input.input.small.mn-add', {
        type: 'text', list: listId, placeholder: '＋ نفر دیگر (شماره یا نام)'
      });
      var opts = {};
      var dl = el('datalist', { id: listId });
      M.scoped().forEach(function (c) {
        if (st.recs.some(function (r) { return r.id === c.id; })) return;
        var label = w.U.toLatinDigits(c.caseNo || '') + ' — ' +
          [c.firstName, c.lastName].filter(Boolean).join(' ');
        opts[label] = c;
        dl.appendChild(el('option', { value: label }));
      });
      add.addEventListener('change', function () {
        var c = opts[add.value];
        if (!c) return;
        st.recs.push(c);
        drawControls();
        render();
      });
      controls.appendChild(row('کارمند' + (st.recs.length > 1 ? 'ان' : ''),
        el('div', null, [ppl, add, dl]),
        'معمولاً یک نفر؛ اگر نامه چند نفر را در بر می‌گیرد، اضافه کنید.'));

      // گیرنده
      var rsel = el('select.input.small');
      MN.conf().recipients.forEach(function (r) {
        var rank = MN.RANKS.filter(function (k) { return k.key === r.rank; })[0];
        rsel.appendChild(el('option', {
          value: r.id, text: MN.titleFor(r, st.recs[0]) + ' — ' + (rank ? rank.label : '')
        }));
      });
      // هر کسِ دیگری در دفتر مقامات هم می‌تواند گیرنده باشد
      var offs = w.Officials ? w.Officials.list() : [];
      if (offs.length) {
        var og = el('optgroup', { label: 'از دفتر مقامات' });
        offs.slice().sort(function (a, b) {
          return (a.org + a.position).localeCompare(b.org + b.position, 'fa');
        }).forEach(function (o) {
          og.appendChild(el('option', { value: 'off:' + o.id,
            text: w.Officials.titleOf(o) + (o.name ? ' — ' + o.name : '') }));
        });
        rsel.appendChild(og);
      }
      rsel.value = st.recipientId;
      rsel.addEventListener('change', function () {
        // «بی‌نام» برای همان گیرنده بود؛ گیرندهٔ دیگر دوباره با نام
        st.recipientId = rsel.value; st.withName = true; drawControls(); render();
      });
      var rk = recipient();
      controls.appendChild(row('گیرنده', rsel,
        (MN.RANKS.filter(function (k) { return k.key === rk.rank; })[0] || {}).label +
        ' ← «' + MN.verbOf(rk.rank) + '». فهرست و رتبه‌ها در تنظیمات.'));
      controls.appendChild(addresseeLine(rk));

      // نامهٔ مرجع
      var rec = st.recs[0];
      var src = el('select.input.small');
      var hasCase = rec.letterNo || rec.letterDate;
      src.appendChild(el('option', {
        value: 'case',
        text: 'نامهٔ گزارش پرونده' + (hasCase
          ? ' (' + [rec.letterNo ? 'ش ' + fa(rec.letterNo) : '', fmt(rec.letterDate)]
            .filter(Boolean).join(' — ') + (rec.reporterOrg ? '، ' + rec.reporterOrg : '') + ')'
          : ' — ثبت نشده')
      }));
      MN.OUR_LETTERS.forEach(function (l) {
        if (!rec[l.no] && !rec[l.date]) return;
        src.appendChild(el('option', {
          value: 'ours:' + l.key,
          text: 'نامهٔ خودمان: ' + l.label + ' (' + [rec[l.no] ? 'ش ' + fa(rec[l.no]) : '',
            fmt(rec[l.date])].filter(Boolean).join(' — ') + ')'
        }));
      });
      src.appendChild(el('option', { value: 'custom', text: 'نامهٔ دیگر…' }));
      src.appendChild(el('option', { value: 'none', text: 'بدون ارجاع' }));
      src.value = st.ref.source;
      src.disabled = st.confidential;
      src.addEventListener('change', function () {
        st.ref.source = src.value; drawControls(); render();
      });
      controls.appendChild(row('نامهٔ مرجع', src));

      if (st.ref.source === 'custom' && !st.confidential) {
        controls.appendChild(el('div.mn-grid', null, [
          row('شمارهٔ نامه', text(st.ref.no, function (v) { st.ref.no = v; render(); },
            'اگر از اتوماسیون آمده')),
          row('تاریخ نامه', dateIn(st.ref.date, function (v) { st.ref.date = v; render(); })),
          row('از طرفِ', text(st.ref.from, function (v) { st.ref.from = v; render(); },
            'مثلاً نهاد راهبردی …')),
          el('div.mn-field', null, [check('نامهٔ خودمان است (پیرو)', st.ref.ours, function (v) {
            st.ref.ours = v; render();
          })])
        ]));
      }

      // نوع ارتباط
      var built = current();
      var rel = el('select.input.small');
      rel.appendChild(el('option', {
        value: 'auto',
        text: 'خودکار' + (built.relation ? ': ' + (MN.RELATIONS.filter(function (r) {
          return r.key === built.relation;
        })[0] || {}).label : '')
      }));
      MN.RELATIONS.forEach(function (r) {
        rel.appendChild(el('option', { value: r.key, text: r.label + ' — «' + r.lead + '»' }));
      });
      rel.value = st.ref.relation;
      rel.disabled = st.confidential || st.ref.source === 'none';
      rel.addEventListener('change', function () { st.ref.relation = rel.value; render(); });
      controls.appendChild(row('نوع ارتباط', rel,
        'نامهٔ خودِ گیرنده: عطف. نامهٔ خودمان: پیرو. بقیه: در ارتباط.'));

      controls.appendChild(el('div.mn-checks', null, [
        check('رونوشت نامه به ما رسیده', st.ref.copy, function (v) {
          st.ref.copy = v; drawControls(); render();
        }, '«با عنایت به رونوشت نامهٔ …»'),
        check('محرمانه (بدون ارجاع)', st.confidential, function (v) {
          st.confidential = v; drawControls(); render();
        }, 'نامهٔ محرمانه پیوست و ارجاع ندارد؛ مستقیم سرِ درخواست می‌رود')
      ]));

      controls.appendChild(el('h5.mn-sub', { text: 'جزئیاتِ ' + MN.typeOf(st.type).label }));
      controls.appendChild(typeControls());
    }

    function typeControls() {
      var o = st.opts, box = el('div.mn-grid');
      var set = function (k) { return function (v) { o[k] = v; render(); }; };
      if (st.type === 'invite') {
        box.appendChild(row('مهلت مراجعه', dateIn(o.due, set('due')),
          st.recs[0].defenseDueDate ? 'از «مهلت حضور و ارائه دفاعیه»' : ''));
        box.appendChild(row('در ارتباط با (اختیاری)', text(o.about, set('about'),
          'مثلاً قرارداد شمارهٔ …')));
      } else if (st.type === 'hearing') {
        box.appendChild(row('تاریخ جلسه', dateIn(o.meetDate, function (v) {
          o.meetDate = v;
          o.proofDate = v ? MN.dayBefore(v) : '';
          drawControls(); render();
        })));
        box.appendChild(row('ساعت', text(o.time, set('time'))));
        box.appendChild(row('محل برگزاری', text(o.place, set('place'))));
        box.appendChild(row('مهلت تصویر پیامک', dateIn(o.proofDate, set('proofDate')),
          'روز کاریِ پیش از جلسه'));
      } else if (st.type === 'defect') {
        box.appendChild(row('در خصوص', text(o.about, set('about'))));
        var docs = el('div.mn-docs');
        var all = MN.conf().docs.concat((o.docs || []).filter(function (d) {
          return MN.conf().docs.indexOf(d) < 0;
        }));
        all.forEach(function (d) {
          docs.appendChild(check(d, (o.docs || []).indexOf(d) >= 0, function (on) {
            o.docs = (o.docs || []).filter(function (x) { return x !== d; });
            if (on) o.docs.push(d);
            render();
          }));
        });
        var more = el('input.input.small', { type: 'text', placeholder: '＋ مدرک دیگر و Enter' });
        more.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' || !more.value.trim()) return;
          e.preventDefault();
          o.docs = (o.docs || []).concat([more.value.trim()]);
          drawControls(); render();
        });
        docs.appendChild(more);
        box.appendChild(row('مدارک خواسته‌شده', docs));
        box.appendChild(el('div.mn-field', null, [
          check('کد ملی در متن', o.withNid, function (v) { o.withNid = v; render(); }),
          check('همراه با دعوت به کمیته', o.withInvite, function (v) {
            o.withInvite = v; drawControls(); render();
          })
        ]));
        if (o.withInvite) box.appendChild(row('مهلت مراجعه', dateIn(o.due, set('due'))));
      } else if (st.type === 'salaryStop') {
        box.appendChild(row('در خصوص', text(o.about, set('about'))));
        box.appendChild(el('div.mn-field', null, [
          check('همراه با دعوت به کمیته', o.withInvite, function (v) {
            o.withInvite = v; drawControls(); render();
          }, 'بی‌تیک: فقط «از پرداخت هرگونه وجه خودداری نمایند»')
        ]));
        if (o.withInvite) box.appendChild(row('مهلت مراجعه', dateIn(o.due, set('due'))));
      }
      return box;
    }

    /* نامِ مخاطب: از دفتر مقامات پیدا شد؟ */
    function addresseeLine(rk) {
      if (!w.Officials) return null;
      var title = MN.titleFor(rk, st.recs[0]);
      var o = rk.official ? w.Officials.get(rk.official) : w.Officials.find(title);
      var openDir = el('button.linkish.tiny', {
        type: 'button', text: 'دفتر مقامات',
        onclick: function () {
          w.UIOfficials.dialog(app, function () { drawControls(); render(); });
        }
      });
      var box = el('div.mn-addressee' + (o ? '.is-found' : ''));
      if (o) {
        var cb = el('input', { type: 'checkbox' });
        cb.checked = st.withName;
        cb.addEventListener('change', function () { st.withName = cb.checked; render(); });
        var age = w.Officials.age();
        box.appendChild(el('label.mn-check', null, [cb, el('span', null, [
          el('b', { text: (o.honor || '') + ' ' + o.name }), el('span', { text: ' — نامِ مخاطب در نامه بیاید' })
        ])]));
        box.appendChild(el('span.mn-hint', null, [
          el('span', { text: 'از ' }), openDir,
          age != null && age > 120
            ? el('span.mn-stale', { text: ' — ' + fa(Math.round(age / 30)) + ' ماه است به‌روز نشده؛ هنوز همین است؟' })
            : null
        ]));
      } else {
        box.appendChild(el('span.mn-hint', null, [
          el('span', { text: w.Officials.list().length
            ? 'نامِ «' + title + '» در دفتر مقامات نیست؛ فقط سمت نوشته می‌شود — '
            : 'برای نوشتنِ نامِ مخاطب («جناب آقای …»)، فهرست مقامات را از اکسل وارد کنید: ' }),
          openDir
        ]));
      }
      return box;
    }

    /* -------------------------------------------------------- کاغذ */
    function headLine(label, value) {
      return el('div.mn-hl', null, [
        el('span.mn-hk', { text: label }),
        el('span.mn-hv', { text: value }),
        el('button.mn-copy1', {
          type: 'button', text: 'کپی', title: 'کپی همین سطر',
          onclick: function () { copy(value, 'کپی شد.'); }
        })
      ]);
    }

    function render() {
      result = current();
      w.U.clear(headBox);
      headBox.appendChild(headLine('گیرنده', result.to));
      headBox.appendChild(headLine('موضوع', result.subject));
      headBox.appendChild(headLine(result.confidential ? 'محرمانه' : 'ارتباط', result.relationText));
      if (result.attach) headBox.appendChild(headLine('پیوست', result.attach));
      if (!st.edited) {
        bodyArea.value = result.text;
        rebuildBtn.style.display = 'none';
        if (bodyArea._spell) bodyArea._spell.refresh();
      }
      var missing = bodyArea.value.indexOf(MN.BLANK) >= 0;
      warnLine.textContent = missing
        ? 'جاهای «' + MN.BLANK + '» هنوز خالی‌اند — از کلیدهای سمت راست یا خودِ پرونده پرشان کنید.' : '';
      warnLine.style.display = missing ? '' : 'none';
      fillReg();
    }

    var warnLine = el('p.mn-warn');

    /* ------------------------------------------------ ثبت در کارها */
    /** اولین خروجیِ هر نوع، در تاریخچهٔ هر پرونده ثبت می‌شود */
    function log(how) {
      if (st.logged[st.type]) return;
      st.logged[st.type] = true;
      st.recs.forEach(function (r) {
        M.addHistory('minute', r, [], 'مینوت ' + result.type.label + ' — ' + result.to +
          ' (' + how + ')');
      });
    }

    function bodyText() { return bodyArea.value; }

    function asDoc() {
      return {
        key: 'minute', paper: 'letterhead', title: 'مینوت ' + result.type.label,
        file: 'minute-' + result.type.key,
        blocks: [
          { t: 'to', lines: [result.to, 'موضوع: ' + result.subject] },
          { t: 'small', text: result.relationText + (result.attach ? ' — پیوست: ' + result.attach : '') }
        ].concat(bodyText().split('\n').filter(function (l) { return l.trim(); }).map(function (p, i) {
          return { t: 'p', justify: i > 0, text: p };
        }))
      };
    }

    /* ---------------------------------------- شمارهٔ نامهٔ صادره */
    var regNo = el('input.input.small', { type: 'text', placeholder: 'شمارهٔ نامه در اتوماسیون' });
    var regDate = J.today();
    var regDateNode = dateIn(regDate, function (v) { regDate = v; });
    var regNote = el('span.mn-hint');
    function fillReg() {
      var t = result.type;
      var f = M.FIELD_BY_KEY[t.caseNo];
      regNote.textContent = f ? 'در «' + String(f.label).replace(/\(\d[^)]*\)/g, '') + '»' +
        (st.recs.length > 1 ? ' هر ' + fa(st.recs.length) + ' پرونده' : '') + ' می‌نشیند.' : '';
    }
    var regBtn = el('button.btn.small', {
      type: 'button', text: 'ثبت در پرونده',
      onclick: function () {
        var t = result.type, o = result.opts;
        if (!regNo.value.trim()) { w.U.toast('شمارهٔ نامه را بنویسید.', 'warn'); regNo.focus(); return; }
        var list = st.recs.map(function (r) {
          var p = {};
          p[t.caseNo] = regNo.value.trim();
          p[t.caseDate] = regDate || J.today();
          // مهلت و تاریخ جلسه، اگر پرونده هنوز نداشت، از همین نامه
          if ((t.key === 'invite' || o.withInvite) && o.due && !r.defenseDueDate) p.defenseDueDate = o.due;
          if (t.key === 'salaryStop' && o.withInvite && !r.invitationLetterNo) {
            p.invitationLetterNo = p[t.caseNo];
            p.invitationLetterDate = p[t.caseDate];
          }
          if (t.key === 'hearing' && o.meetDate && !r.committeeDate) p.committeeDate = o.meetDate;
          return { id: r.id, patch: p, note: 'شمارهٔ نامهٔ صادره از مینوت ' + t.label };
        });
        M.applyPatches(list, { kind: 'update', note: 'ثبت شمارهٔ نامهٔ صادره' }).then(function (res) {
          if (w.Checklist) st.recs.forEach(function (r) { w.Checklist.sync(M.get(r.id)); });
          w.U.toast('شمارهٔ نامه در ' + fa(res.changed) + ' پرونده ثبت شد.', 'good');
          if (app && app.render) app.render();
        });
      }
    });

    /* -------------------------------------------------------- چیدمان */
    paper.appendChild(headBox);
    paper.appendChild(el('div.mn-body-wrap', null, [bodyArea, rebuildBtn, spellBox]));
    paper.appendChild(warnLine);
    paper.appendChild(el('div.mn-reg', null, [
      el('b', { text: 'شمارهٔ نامه را گرفتید؟' }),
      regNo, regDateNode, regBtn, regNote
    ]));

    var body = el('div.mn-dialog', null, [controls, paper]);
    resetOpts();
    if (startOpts.opts) Object.assign(st.opts, startOpts.opts);
    drawControls();
    render();

    var m = w.U.modal('مینوت نامه', body, [
      el('button.btn.ghost', { type: 'button', text: 'بستن', onclick: function () { m.close(); } }),
      el('button.btn', {
        type: 'button', text: 'چاپ',
        onclick: checked('چاپ شود', function () { log('چاپ'); m.close(); w.UILetters.printDoc(asDoc()); })
      }),
      el('button.btn', {
        type: 'button', text: 'ورد',
        onclick: checked('فایل ورد ساخته شود', function () {
          log('ورد');
          var caseNo = w.U.toLatinDigits(st.recs[0].caseNo || '').replace(/[^\w.-]+/g, '-');
          w.UILetters.wordDoc(asDoc(), 'minute-' + result.type.key + (caseNo ? '-' + caseNo : '') + '.docx');
        })
      }),
      el('button.btn', {
        type: 'button', text: 'کپی با سربرگ',
        title: 'گیرنده، موضوع، ارتباط و پیوست، و بعد متن',
        onclick: checked('کپی شود', function () {
          log('کپی');
          var r = result;
          copy(['گیرنده: ' + r.to, 'موضوع: ' + r.subject, r.relationText,
            r.attach ? 'پیوست: ' + r.attach : ''].filter(Boolean).join('\n') + '\n\n' + bodyText(),
          'مینوت با سربرگ کپی شد.');
        })
      }),
      el('button.btn.primary', {
        type: 'button', text: 'کپی برای اتوماسیون',
        onclick: checked('کپی شود', function () { log('کپی'); copy(bodyText(), 'متن نامه کپی شد؛ در اتوماسیون بچسبانید.'); })
      })
    ]);
    m.root.classList.add('minute-modal');
    m.state = st;
    m.result = function () { return result; };
    return m;
  }

  /* ------------------------------------------------- بخش تنظیمات */
  function settingsBlock() {
    var c = MN.conf();
    var data = JSON.parse(JSON.stringify(c.recipients));
    var list = el('div.mn-rcp-list');
    function draw() {
      w.U.clear(list);
      data.forEach(function (r, i) {
        var title = el('input.input.small', { type: 'text', value: r.title });
        title.addEventListener('input', function () { r.title = title.value; });
        var rank = el('select.input.small');
        MN.RANKS.forEach(function (k) {
          rank.appendChild(el('option', { value: k.key, text: k.label + ' — ' + k.verb }));
        });
        rank.value = r.rank;
        rank.addEventListener('change', function () { r.rank = rank.value; });
        var kind = el('select.input.small');
        [['employer', 'کارفرمای قرارداد'], ['workplace', 'محل خدمت'], ['other', 'سایر']]
          .forEach(function (k) { kind.appendChild(el('option', { value: k[0], text: k[1] })); });
        kind.value = r.kind || 'workplace';
        kind.addEventListener('change', function () { r.kind = kind.value; });
        var unit = el('input.input.small', { type: 'text', value: r.unit || '', placeholder: 'منطقه / سازمان / شرکت' });
        unit.addEventListener('input', function () { r.unit = unit.value; });
        var match = el('input.input.small', { type: 'text', value: r.match || '', placeholder: 'نوع قرارداد (اختیاری)' });
        match.addEventListener('input', function () { r.match = match.value; });
        list.appendChild(el('div.mn-rcp', null, [
          title, rank, kind, unit, match,
          el('button.btn.small.ghost', {
            type: 'button', text: 'حذف',
            onclick: function () { data.splice(i, 1); draw(); }
          })
        ]));
      });
    }
    draw();
    var rulesNo = el('input.input.small', { type: 'text', value: c.rulesNo });
    var rulesDate = c.rulesDate;
    var time = el('input.input.small', { type: 'text', value: c.hearingTime });
    var place = el('input.input.small', { type: 'text', value: c.hearingPlace });
    var docs = el('textarea.input.area', { rows: 3, value: c.docs.join('\n') });

    return el('section.set-block.mn-settings', null, [
      el('h4', { text: 'مینوت نامه' }),
      el('p.set-note', {
        text: 'رتبهٔ گیرنده فعلِ نامه را تعیین می‌کند: پایین‌دست «مقتضی است»، همتراز ' +
          '«شایسته است»، بالادست «خواهشمند است». در عنوان، {منطقه} و {محل خدمت} از ' +
          'خودِ پرونده پر می‌شوند. «نوع قرارداد» که بخورد، همان گیرنده پیشنهاد می‌شود.'
      }),
      el('div.mn-rcp.mn-rcp-head', null, ['عنوان گیرنده', 'رتبه', 'جنس', 'واحد («آن …»)',
        'نوع قرارداد', ''].map(function (t) { return el('span', { text: t }); })),
      list,
      el('div.btn-row', null, [
        el('button.btn.small.ghost', {
          type: 'button', text: '＋ گیرندهٔ تازه',
          onclick: function () {
            data.push({ id: w.U.uid(), title: '', rank: 'peer', kind: 'workplace', unit: 'منطقه', match: '' });
            draw();
          }
        }),
        w.UIOfficials ? el('button.btn.small', {
          type: 'button',
          text: 'دفتر مقامات (' + fa(w.Officials.list().length) + ' نفر)',
          title: 'نام شهرداران و مدیران — برای «جناب آقای … شهردار محترم منطقه ۵»',
          onclick: function () { w.UIOfficials.dialog(null); }
        }) : null
      ]),
      el('div.mn-conf-grid', null, [
        row('شمارهٔ ابلاغ آیین‌نامه', rulesNo),
        row('تاریخ ابلاغ آیین‌نامه', dateIn(rulesDate, function (v) { rulesDate = v; })),
        row('ساعت پیش‌فرض جلسه', time),
        row('محل پیش‌فرض جلسه', place)
      ]),
      row('مدارک پیش‌فرض «تکمیل مستندات» — هر سطر یکی', docs),
      el('div.btn-row', null, [
        el('button.btn.small.primary', {
          type: 'button', text: 'ذخیرهٔ تنظیمات مینوت',
          onclick: function () {
            MN.saveConf({
              recipients: data.filter(function (r) { return String(r.title).trim(); }),
              rulesNo: rulesNo.value.trim(), rulesDate: rulesDate,
              hearingTime: time.value.trim(), hearingPlace: place.value.trim(),
              docs: docs.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
            }).then(function () { w.U.toast('تنظیمات مینوت ذخیره شد.', 'good'); });
          }
        })
      ])
    ]);
  }

  w.UIMinute = { open: open, settingsBlock: settingsBlock };
})(window);
