/*
 * کارها — نمای «کارها» و پنجرهٔ ثبت کار.
 *
 * کارتابل می‌گوید هر پرونده در چه مرحله‌ای است. ولی کارِ روزِ دبیرخانه
 * فقط مرحلهٔ پرونده‌ها نیست: «اسکن مدارک این پرونده»، «پرینت دستور کار
 * جلسه»، «پیگیری نامهٔ حراست» — و کارهایی که اصلاً پرونده‌ای پشتشان
 * نیست و شفاهی یا با اتوماسیون ارجاع می‌شوند.
 *
 * سه اصل در طراحی این نما:
 *
 *   ۱) سررسید، محور است. کار بدون تاریخ فراموش می‌شود، پس سطل‌بندی بر
 *      اساس سررسید است نه بر اساس پرونده یا دسته: عقب‌افتاده، امروز،
 *      این هفته، بعداً، بی‌سررسید. کسی که صبح این صفحه را باز می‌کند
 *      باید در یک نگاه بداند امروز چه باید بکند.
 *
 *   ۲) ثبت باید از تایپ کردن ارزان‌تر باشد. کارهای پرتکرار دکمه‌اند؛
 *      یک کلیک کار را می‌سازد. اگر ثبت کار وقت بگیرد، کسی ثبت نمی‌کند
 *      و فهرست از واقعیت عقب می‌افتد.
 *
 *   ۳) «لغو» با «انجام شد» یکی نیست. کاری که منتفی شده باید از فهرست
 *      برود ولی در گزارش به‌حساب انجام‌شده نیاید، وگرنه آمار دروغ
 *      می‌گوید.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, N = w.Notes;

  function fa(n) { return w.U.toFaDigits(n); }

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  /**
   * پیدا کردن پرونده از روی چیزی که کاربر تایپ کرده.
   *
   * کسی که کار را ثبت می‌کند معمولاً شمارهٔ پرونده را حفظ نیست؛ نام طرف یا
   * کد ملی‌اش را می‌داند. پس هر سه می‌گیرد: شماره، نام (و نام خانوادگی)، و
   * کد ملی. اول تطبیق دقیق، بعد «شروع می‌شود با»، بعد «شامل».
   */
  function findCase(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    // برچسب فهرست خودمان: «شماره — نام — کد ملی»
    var head = w.U.toLatinDigits(raw.split('—')[0]).trim();
    var norm = w.U.normalize(raw);
    var exact = null, starts = null, has = null;
    M.state.cases.forEach(function (c) {
      var no = w.U.toLatinDigits(c.caseNo || '').trim();
      var nid = w.U.toLatinDigits(c.nationalId || '').trim();
      if (no && no === head) { exact = exact || c; return; }
      if (nid && (nid === head || nid === w.U.toLatinDigits(raw).trim())) {
        exact = exact || c;
        return;
      }
      var name = w.U.normalize([c.firstName, c.lastName].filter(Boolean).join(' '));
      if (!name || !norm) return;
      if (name === norm) exact = exact || c;
      else if (name.indexOf(norm) === 0) starts = starts || c;
      else if (name.indexOf(norm) >= 0) has = has || c;
    });
    return exact || starts || has;
  }

  function caseLabel(rec) {
    return w.U.toLatinDigits(rec.caseNo || '') + ' — ' + personOf(rec) +
      (rec.nationalId ? ' — ' + w.U.toLatinDigits(rec.nationalId) : '');
  }

  /* ================================================================
     پنجرهٔ ثبت / ویرایش کار
     ================================================================ */

  /**
   * dialog(app, o, onDone)
   * o: { task } برای ویرایش، { caseId } برای کارِ تازهٔ یک پرونده،
   * { due } برای سررسیدِ از پیش تعیین‌شده (از تقویم).
   */
  function dialog(app, o, onDone) {
    o = o || {};
    var task = o.task || null;
    var fixedCase = o.caseId || (task ? task.caseId : '');
    var lockCase = !!o.caseId && !task;      // از داخل پرونده باز شده

    var state = {
      title: task ? (task.title || '') : '',
      text: task ? (task.text || '') : '',
      followUp: task ? (task.followUp || '') : (o.due || ''),
      priority: task ? (task.priority || 'normal') : 'normal',
      from: task ? (task.from || '') : '',
      owner: task ? (task.owner || '') : (M.state.settings.user || ''),
      category: task ? (task.category || '') : '',
      caseId: fixedCase || ''
    };

    var body = el('div.task-dialog');

    // --- عنوان + میان‌برهای کارهای پرتکرار ---
    var titleInput = el('input.input.task-title-input', {
      type: 'text', value: state.title,
      placeholder: 'کار چیست؟ مثلاً: اسکن مدارک و بارگذاری در پرونده'
    });
    titleInput.addEventListener('input', function () {
      state.title = titleInput.value;
    });

    var chips = el('div.task-presets');
    function fillChips() {
      w.U.clear(chips);
      N.presets().forEach(function (p) {
        chips.appendChild(el('button.chip-btn', {
          type: 'button', text: p,
          onclick: function () {
            state.title = p;
            titleInput.value = p;
            titleInput.focus();
          }
        }));
      });
      /* میان‌بر تازه از همین‌جا اضافه می‌شود: کاری که دو بار تکرار شود،
         بار سوم باید دکمه داشته باشد. */
      chips.appendChild(el('button.chip-btn.chip-add', {
        type: 'button', text: '＋ میان‌بر تازه',
        title: 'عنوان فعلی را به‌عنوان یک کارِ پرتکرار ذخیره کن',
        onclick: function () {
          var seed = state.title.trim();
          askNewItem('میان‌بر تازه', 'TaskPresets', seed,
            'به دکمه‌های ثبت سریع اضافه می‌شود.', function (name) {
              state.title = name;
              titleInput.value = name;
              fillChips();
            });
        }
      }));
    }
    fillChips();

    body.appendChild(el('label.field.wide', null, [
      el('span.field-label', { text: 'عنوان کار' }), titleInput
    ]));
    body.appendChild(chips);

    // --- پرونده (اختیاری) ---
    if (lockCase) {
      var rec0 = M.get(state.caseId);
      body.appendChild(el('p.task-oncase', {
        text: 'این کار به پروندهٔ ' + (rec0 ? caseLabel(rec0) : '—') + ' وصل می‌شود.'
      }));
    } else {
      var listId = 'task-cases-' + w.U.uid();
      var dl = el('datalist', { id: listId });
      M.state.cases.forEach(function (c) {
        dl.appendChild(el('option', { value: caseLabel(c) }));
      });
      var caseInput = el('input.input', {
        type: 'text', list: listId,
        value: state.caseId && M.get(state.caseId) ? caseLabel(M.get(state.caseId)) : '',
        placeholder: 'شمارهٔ پرونده، نام، یا کد ملی — خالی یعنی بی‌پرونده'
      });
      var caseHint = el('span.muted.tiny');
      function syncCase() {
        var raw = caseInput.value.trim();
        if (!raw) {
          state.caseId = '';
          caseHint.textContent = 'کارِ بیرون از پرونده‌ها.';
          caseHint.className = 'muted tiny';
          return;
        }
        var rec = findCase(raw);
        state.caseId = rec ? rec.id : '';
        caseHint.textContent = rec
          ? 'پرونده: ' + caseLabel(rec)
          : 'با این شماره، نام یا کد ملی پرونده‌ای پیدا نشد؛ کار بدون پرونده ثبت می‌شود.';
        caseHint.className = rec ? 'muted tiny' : 'tiny warn-text';
      }
      caseInput.addEventListener('input', syncCase);
      syncCase();
      body.appendChild(el('label.field.wide', null, [
        el('span.field-label', { text: 'پروندهٔ مربوط (اختیاری)' }),
        caseInput, dl, caseHint
      ]));
    }

    // --- سررسید ---
    var dateField = w.DatePicker.field(state.followUp, function (v) {
      state.followUp = v;
    });
    function quick(label, days) {
      return el('button.btn.small.ghost', {
        type: 'button', text: label,
        onclick: function () {
          var d = days === 0 ? J.today() : J.addDays(J.today(), days);
          state.followUp = d;
          dateField.setValue(d);
        }
      });
    }
    body.appendChild(el('div.task-row', null, [
      el('span.field-label', { text: 'سررسید' }),
      dateField,
      quick('امروز', 0), quick('فردا', 1), quick('یک هفته', 7),
      el('button.btn.small.ghost', {
        type: 'button', text: 'بدون سررسید',
        onclick: function () { state.followUp = ''; dateField.setValue(''); }
      })
    ]));

    // --- فوریت ---
    var prioButtons = {};
    var prio = el('div.task-prio', null, N.PRIORITIES.map(function (p) {
      var b = el('button.chip-btn.prio-' + p.key, {
        type: 'button', text: p.label,
        onclick: function () {
          state.priority = p.key;
          Object.keys(prioButtons).forEach(function (k) {
            prioButtons[k].classList.toggle('on', k === state.priority);
          });
        }
      });
      prioButtons[p.key] = b;
      if (p.key === state.priority) b.classList.add('on');
      return b;
    }));
    body.appendChild(el('div.task-row', null, [
      el('span.field-label', { text: 'فوریت' }), prio
    ]));

    // --- ارجاع‌دهنده / مسئول / دسته ---
    /* این دو فیلد از دادهٔ قبلی خودشان یاد می‌گیرند: هر چه تا امروز نوشته
       شده پیشنهاد می‌شود، پرتکرارترین اول. وگرنه «رئیس کمیته» و «رییس
       کمیته» دو چیز جدا می‌شوند و گزارشِ به‌تفکیکِ ارجاع‌دهنده بی‌معنا. */
    function remembering(field, extra, ph, value) {
      var id = 'task-' + field + '-' + w.U.uid();
      var seen = {}, opts = [];
      N.usedValues(field).concat(extra || []).forEach(function (v) {
        if (!v || seen[v]) return;
        seen[v] = 1;
        opts.push(v);
      });
      var dl = el('datalist', { id: id });
      opts.forEach(function (v) { dl.appendChild(el('option', { value: v })); });
      var input = el('input.input.small', {
        type: 'text', list: id, value: value, placeholder: ph
      });
      /* datalist باید در سند باشد تا input با list=id پیدایش کند؛ کنار
         خودِ input می‌نشیند نه داخلش — input فرزند نمی‌پذیرد. */
      return { input: input, datalist: dl };
    }

    function fieldWith(label, pair) {
      return el('label.field', null, [
        el('span.field-label', { text: label }), pair.input, pair.datalist
      ]);
    }

    var fromPair = remembering('from', [], 'چه کسی گفته؟ مثلاً: رئیس کمیته',
      state.from);
    var fromInput = fromPair.input;
    fromInput.addEventListener('input', function () { state.from = fromInput.value; });

    /* کارشناسان پرونده‌ها هم پیشنهاد می‌شوند: کارِ دبیرخانه معمولاً دست
       همان‌هاست، و فهرستشان از قبل در برنامه هست. */
    var ownerPair = remembering('owner',
      (M.state.lists || {}).Karshenas || [], 'با چه کسی است؟', state.owner);
    var ownerInput = ownerPair.input;
    ownerInput.addEventListener('input', function () { state.owner = ownerInput.value; });

    var catSelect = el('select.input.small');
    var NEW_CAT = '\u0000new';
    function fillCats() {
      w.U.clear(catSelect);
      catSelect.appendChild(el('option', { value: '', text: '— بدون دسته —' }));
      N.categories().forEach(function (c) {
        catSelect.appendChild(el('option', { value: c, text: c }));
      });
      catSelect.appendChild(el('option', { value: NEW_CAT, text: '＋ دستهٔ تازه…' }));
      catSelect.value = state.category;
    }
    fillCats();
    catSelect.addEventListener('change', function () {
      if (catSelect.value !== NEW_CAT) {
        state.category = catSelect.value;
        return;
      }
      catSelect.value = state.category;
      askNewItem('دستهٔ تازه', 'TaskCategories', '',
        'به فهرست دسته‌ها اضافه می‌شود و از این پس همه‌جا هست.',
        function (name) {
          state.category = name;
          fillCats();
        });
    });

    body.appendChild(el('div.task-grid', null, [
      fieldWith('ارجاع‌دهنده', fromPair),
      fieldWith('مسئول انجام', ownerPair),
      el('label.field', null, [
        el('span.field-label', { text: 'دسته' }), catSelect
      ])
    ]));

    // --- توضیح ---
    var textArea = el('textarea.input.area', {
      rows: 2, value: state.text,
      placeholder: 'توضیح بیشتر، اگر لازم است.'
    });
    textArea.addEventListener('input', function () { state.text = textArea.value; });
    body.appendChild(el('label.field.wide', null, [
      el('span.field-label', { text: 'توضیح (اختیاری)' }), textArea
    ]));

    var m;
    var save = el('button.btn.primary', {
      type: 'button', text: task ? 'ذخیرهٔ تغییرات' : 'ثبت کار',
      onclick: function () {
        if (!state.title.trim()) {
          w.U.toast('عنوان کار را بنویسید.', 'warn');
          titleInput.focus();
          return;
        }
        save.disabled = true;
        var patch = {
          title: state.title.trim(), text: state.text.trim(),
          followUp: state.followUp, priority: state.priority,
          from: state.from.trim(), owner: state.owner.trim(),
          category: state.category, caseId: state.caseId,
          caseNo: state.caseId && M.get(state.caseId)
            ? (M.get(state.caseId).caseNo || '') : ''
        };
        var p = task ? N.update(task, patch)
          : N.create({
            kind: 'task', caseId: patch.caseId, title: patch.title,
            text: patch.text, followUp: patch.followUp, priority: patch.priority,
            from: patch.from, owner: patch.owner, category: patch.category
          });
        p.then(function () {
          m.close();
          w.U.toast(task ? 'کار به‌روز شد.' : 'کار ثبت شد.', 'good');
          if (onDone) onDone();
        }).catch(function (e) {
          save.disabled = false;
          w.U.toast(e.message, 'bad');
        });
      }
    });

    m = w.U.modal(task ? 'ویرایش کار' : 'کار تازه', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      save
    ]);
    m.root.classList.add('task-modal');
    setTimeout(function () { titleInput.focus(); }, 50);
    return m;
  }

  /**
   * پنجرهٔ کوچک افزودن به یک فهرست (دسته یا میان‌بر).
   *
   * عمداً همین‌جاست و نه در تنظیمات: رفتن به تنظیمات وسط ثبت یک کار یعنی
   * رها کردن فرم نیمه‌کاره، و همین باعث می‌شود همه‌چیز «سایر» بماند.
   */
  function askNewItem(title, list, seed, hint, onAdd) {
    var input = el('input.input', { type: 'text', value: seed || '', placeholder: title });
    var msg = el('p.muted.tiny', {
      text: hint + ' از تنظیمات ← فهرست‌ها هم می‌شود ویرایشش کرد.'
    });
    var m;
    function save() {
      N.addToList(list, input.value).then(function (name) {
        m.close();
        w.U.toast('«' + name + '» اضافه شد.', 'good');
        onAdd(name);
      }).catch(function (e) { w.U.toast(e.message, 'bad'); });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    });
    m = w.U.modal(title, el('div', null, [input, msg]), [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', { type: 'button', text: 'افزودن', onclick: save })
    ]);
    m.root.classList.add('small-modal');
    setTimeout(function () { input.focus(); input.select(); }, 50);
  }

  /** ثبت سریع با یک کلیک — بدون پنجره، با سررسیدِ امروز */
  function quickAdd(app, title, caseId, refresh) {
    return N.create({
      kind: 'task', title: title, caseId: caseId || '', followUp: J.today()
    }).then(function () {
      w.U.toast('«' + title + '» به کارهای امروز اضافه شد.', 'good');
      if (refresh) refresh();
    }).catch(function (e) { w.U.toast(e.message, 'bad'); });
  }

  /* ================================================================
     سطر یک کار
     ----------------------------------------------------------------
     شکلش عمداً چک‌لیست است نه سطرِ جدول: مربعِ تیک سمت راست، عنوان در
     وسط، و کارهای فرعی (ویرایش، لغو، حذف) فقط وقتی موس روی سطر است.
     ================================================================ */
  function row(app, task, refresh, opts) {
    opts = opts || {};
    var done = task.status === 'done';
    var cancelled = task.status === 'cancelled';
    var bucket = N.bucketOf(task);
    var late = !done && !cancelled && bucket === 'overdue';

    var cls = 'li.task' + (done ? '.is-done' : '') + (cancelled ? '.is-cancelled' : '') +
      (late ? '.is-late' : '') + (task.priority === 'urgent' ? '.is-urgent' : '') +
      (task.archived ? '.is-archived' : '');

    var box = el('button.task-check', {
      type: 'button',
      title: done || cancelled ? 'باز کردن دوباره' : 'انجام شد',
      'aria-label': done || cancelled ? 'باز کردن دوباره' : 'انجام شد',
      onclick: function () {
        var p = (done || cancelled) ? N.reopen(task) : N.complete(task);
        p.then(function () { if (refresh) refresh(); });
      }
    }, [el('span.task-tick', { text: '✓' })]);

    var meta = [];
    if (task.followUp) {
      meta.push(el('span.task-due' + (late ? '.late' : ''), {
        text: (done ? '' : w.UINotes.relativeDay(task.followUp) + ' • ') +
          J.format(task.followUp)
      }));
    }
    if (!opts.hideCase && task.caseId) {
      var rec = M.get(task.caseId);
      if (rec) {
        meta.push(el('button.task-case', {
          type: 'button', title: 'رفتن به پرونده',
          text: w.U.toLatinDigits(rec.caseNo || '') + ' — ' + personOf(rec),
          onclick: function (e) { e.stopPropagation(); app.openCase(rec.id); }
        }));
      }
    }
    /* کاری که از یک بارگذاری ساخته شده، باید به همان دسته برگردد —
       وگرنه «۱۰ اسکن آرا» فقط یک جملهٔ بی‌مرجع است. */
    if (task.batchId) {
      meta.push(el('button.task-batch', {
        type: 'button', title: 'دیدن سندهای این دسته در بایگانی',
        text: (task.docCount ? fa(task.docCount) + ' سند' : 'این دسته') + ' در بایگانی ←',
        onclick: function (e) {
          e.stopPropagation();
          app.state.archive = {
            q: '', tags: [], batchId: task.batchId, scope: '', kind: ''
          };
          app.goArchive();
        }
      }));
    }
    if (task.from) meta.push(el('span.task-from', { text: 'از: ' + task.from }));
    if (task.category) meta.push(el('span.task-cat', { text: task.category }));
    if (cancelled) {
      meta.push(el('span.task-cancel-why', {
        text: 'لغو شد' + (task.cancelReason ? ' — ' + task.cancelReason : '')
      }));
    }

    var actions = el('div.task-actions', null, [
      /*
       * بارگذاری از دلِ خودِ کار.
       * «اسکن مدارک» یک کار است و خروجی‌اش فایل — و تا امروز باید
       * می‌رفتی به بایگانی، بارگذاری می‌کردی، برمی‌گشتی و کار را تیک
       * می‌زدی. حالا همان‌جا: اگر کار پرونده دارد سندها به همان پرونده
       * می‌روند، وگرنه به بایگانی؛ و خودِ کار صاحب آن دسته می‌شود و
       * تیک می‌خورد.
       */
      task.batchId ? null : el('button.icon-btn.tiny', {
        type: 'button', title: 'بارگذاری دسته‌ای سند برای این کار',
        'aria-label': 'بارگذاری سند',
        html: w.Mobile.icon('upload'),
        onclick: function () { uploadForTask(app, task, refresh); }
      }),
      el('button.icon-btn.tiny', {
        type: 'button', title: 'ویرایش', 'aria-label': 'ویرایش',
        html: w.Mobile.icon('pencil'),
        onclick: function () { dialog(app, { task: task }, refresh); }
      }),
      (done || cancelled) ? null : el('button.icon-btn.tiny', {
        type: 'button', title: 'لغو کار (انجام نشد و لازم نیست)',
        'aria-label': 'لغو کار', text: '⦸',
        onclick: function () { askCancel(task, refresh); }
      }),
      /* بایگانی فقط برای کارِ بسته‌شده معنا دارد: کارِ بازِ بایگانی‌شده
         یعنی کاری که نه انجام شده نه دیده می‌شود. */
      (done || cancelled) ? el('button.icon-btn.tiny', {
        type: 'button',
        title: task.archived ? 'برگرداندن از بایگانی' : 'بایگانی کن',
        'aria-label': task.archived ? 'برگرداندن از بایگانی' : 'بایگانی',
        html: w.Mobile.icon(task.archived ? 'upload' : 'backup'),
        onclick: function () {
          (task.archived ? N.unarchive(task) : N.archive(task))
            .then(function () { if (refresh) refresh(); });
        }
      }) : null,
      el('button.icon-btn.tiny.danger', {
        type: 'button', title: 'حذف', 'aria-label': 'حذف',
        html: w.Mobile.icon('trash'),
        onclick: function () {
          w.U.confirmBox('حذف کار', '«' + (task.title || '') + '» پاک شود؟',
            'حذف کن').then(function (ok) {
              if (ok) N.remove(task).then(function () { if (refresh) refresh(); });
            });
        }
      })
    ]);

    return el(cls, null, [
      box,
      el('div.task-body', null, [
        el('p.task-title', { text: task.title || N.preview(task.text, 80) }),
        task.text && task.title ? el('p.task-text', { text: task.text }) : null,
        meta.length ? el('div.task-meta', null, meta) : null
      ]),
      actions
    ]);
  }

  /**
   * بارگذاری دسته‌ای برای یک کار.
   * پروندهٔ کار، پروندهٔ پیش‌فرضِ همهٔ فایل‌هاست — ولی هر سطر می‌تواند
   * خودش را عوض کند، چون یک نوبت اسکن ممکن است چند پرونده را بگیرد.
   */
  function uploadForTask(app, task, refresh) {
    var rec = task.caseId ? M.get(task.caseId) : null;
    w.UIDocs.batchUpload(function () {
      if (refresh) refresh();
    }, null, {
      batchName: task.title || '',
      task: task,
      caseText: rec ? w.UIDocs.caseLabel(rec) : ''
    });
  }

  function askCancel(task, refresh) {
    var input = el('input.input', {
      type: 'text', placeholder: 'چرا منتفی شد؟ (اختیاری)'
    });
    var m;
    m = w.U.modal('لغو کار', el('div', null, [
      el('p', { text: '«' + (task.title || '') + '» لغو می‌شود.' }),
      el('p.muted.tiny', {
        text: 'کار لغوشده در گزارش، جدا از کارهای انجام‌شده شمرده می‌شود.'
      }),
      input
    ]), [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'لغو کن',
        onclick: function () {
          N.cancelTask(task, input.value).then(function () {
            m.close();
            if (refresh) refresh();
          });
        }
      })
    ]);
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ================================================================
     بخش «کارهای امروز» در کارتابل
     ================================================================ */
  function todaySection(app) {
    var items = N.todayTasks();
    if (!items.length) return null;
    var late = items.filter(function (t) { return N.bucketOf(t) === 'overdue'; }).length;
    return el('section.wl-section.task-section', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: 'کارهای امروز' }),
        el('span.wl-count' + (late ? '.late' : ''), {
          text: late ? fa(late) + ' عقب‌افتاده از ' + fa(items.length)
            : fa(items.length) + ' کار'
        }),
        el('p.wl-sub', { text: 'کارهایی که سررسیدشان رسیده یا گذشته است.' }),
        el('span.spacer'),
        el('button.btn.small.ghost', {
          type: 'button', text: 'همهٔ کارها',
          onclick: function () { app.goTasks(); }
        }),
        el('button.btn.small.primary', {
          type: 'button', text: '＋ کار تازه',
          onclick: function () {
            dialog(app, {}, function () { app.render(); });
          }
        })
      ]),
      el('ul.task-list', null, items.slice(0, 12).map(function (t) {
        return row(app, t, function () { app.render(); });
      }))
    ]);
  }

  /* ================================================================
     چک‌لیست کارهای یک پرونده — داخل تب «کارها و یادداشت‌ها»
     ================================================================ */
  function casePanel(app, rec, refresh) {
    var open = N.tasks({ caseId: rec.id, status: 'open' });
    var done = N.tasks({ caseId: rec.id, status: 'done' })
      .concat(N.tasks({ caseId: rec.id, status: 'cancelled' }));

    var panel = el('div.task-case-panel');

    var quickBar = el('div.task-quick', null,
      [el('span.muted.tiny', { text: 'ثبت سریع:' })].concat(
        N.presets().slice(0, 6).map(function (p) {
          return el('button.chip-btn', {
            type: 'button', text: '＋ ' + p,
            title: 'با سررسید امروز ثبت می‌شود',
            onclick: function () { quickAdd(app, p, rec.id, refresh); }
          });
        })
      ).concat([
        el('button.chip-btn.chip-add', {
          type: 'button', text: '＋', title: 'افزودن میان‌بر تازه',
          onclick: function () {
            askNewItem('میان‌بر تازه', 'TaskPresets', '',
              'به دکمه‌های ثبت سریع اضافه می‌شود.', refresh);
          }
        }),
        el('div.spacer'),
        el('button.btn.small.primary', {
          type: 'button', text: 'کار تازه…',
          onclick: function () { dialog(app, { caseId: rec.id }, refresh); }
        })
      ]));
    panel.appendChild(quickBar);

    if (!open.length && !done.length) {
      panel.appendChild(el('p.muted.tiny', {
        text: 'کاری برای این پرونده ثبت نشده است. کارهای دفتری — اسکن، ' +
          'پرینت، تماس — را همین‌جا بگذارید تا از قلم نیفتند.'
      }));
      return panel;
    }

    if (open.length) {
      panel.appendChild(el('ul.task-list', null, open.map(function (t) {
        return row(app, t, refresh, { hideCase: true });
      })));
    } else {
      panel.appendChild(el('p.muted.tiny', { text: 'کار بازی نمانده است.' }));
    }

    if (done.length) {
      var box = el('details.task-done-box', null, [
        el('summary', { text: fa(done.length) + ' کار بسته‌شده' })
      ]);
      box.appendChild(el('ul.task-list', null, done.map(function (t) {
        return row(app, t, refresh, { hideCase: true });
      })));
      panel.appendChild(box);
    }
    return panel;
  }

  /* ================================================================
     گزارش کارها (فاز ۲)
     ================================================================ */
  function reportBlock(app) {
    var r = N.report();
    var box = el('details.task-report', null, [
      el('summary', { text: 'گزارش کارها — از ' + J.format(r.from) + ' تا امروز' })
    ]);

    box.appendChild(el('div.task-report-nums', null, [
      el('div.task-num.good', null, [
        el('b', { text: fa(r.done) }), el('span', { text: 'انجام‌شده در این ماه' })
      ]),
      el('div.task-num' + (r.overdue ? '.bad' : ''), null, [
        el('b', { text: fa(r.overdue) }), el('span', { text: 'عقب‌افتاده' })
      ]),
      el('div.task-num', null, [
        el('b', { text: fa(r.open) }), el('span', { text: 'باز و در مهلت' })
      ]),
      el('div.task-num', null, [
        el('b', { text: fa(r.cancelled) }), el('span', { text: 'لغوشده' })
      ])
    ]));

    function table(title, rows, emptyText) {
      if (!rows.length) {
        return el('div.task-report-table', null, [
          el('h4', { text: title }),
          el('p.muted.tiny', { text: emptyText })
        ]);
      }
      var t = el('table.c-table.task-tbl', null, [
        el('thead', null, [el('tr', null, [
          el('th', { text: title }),
          el('th', { text: 'انجام‌شده' }),
          el('th', { text: 'عقب‌افتاده' }),
          el('th', { text: 'باز' }),
          el('th', { text: 'لغو' })
        ])]),
        el('tbody', null, rows.map(function (x) {
          return el('tr', null, [
            el('td', { text: x.key }),
            el('td', { text: fa(x.done) }),
            el('td' + (x.overdue ? '.late' : ''), { text: fa(x.overdue) }),
            el('td', { text: fa(x.open) }),
            el('td', { text: fa(x.cancelled) })
          ]);
        }))
      ]);
      return el('div.task-report-table', null, [t]);
    }

    box.appendChild(table('ارجاع‌دهنده', r.byFrom, 'ارجاع‌دهنده‌ای ثبت نشده است.'));
    box.appendChild(table('دسته', r.byCategory, 'دسته‌ای ثبت نشده است.'));
    return box;
  }

  /* ================================================================
     نمای «کارها»
     ================================================================ */
  var FILTERS = [
    { key: 'all', label: 'همه' },
    { key: 'standalone', label: 'بیرون از پرونده' },
    { key: 'oncase', label: 'روی پرونده' },
    { key: 'urgent', label: 'فوری' }
  ];

  function render(app, mount) {
    var st = app.state;
    if (!st.taskFilter) st.taskFilter = 'all';
    if (st.taskCat == null) st.taskCat = null;      // null = همهٔ دسته‌ها
    if (!st.taskGroup) st.taskGroup = 'due';        // due | cat
    var refresh = function () { app.render(); };
    var archived = st.taskFilter === 'archived';

    /* یک صافی، در یک جا: هر سه چیز (دامنه، دسته، بایگانی) به همین شکل
       می‌رسند تا شمارنده و فهرست هیچ‌وقت از هم جدا نیفتند. */
    function keep(t) {
      if (st.taskFilter === 'oncase' && !t.caseId) return false;
      if (st.taskFilter === 'urgent' && t.priority !== 'urgent') return false;
      if (st.taskCat != null && (t.category || '') !== st.taskCat) return false;
      return true;
    }

    var base = { archived: archived };
    if (st.taskFilter === 'standalone') base.standalone = true;

    var groups;
    if (archived) {
      var arc = N.tasks({ archived: true }).filter(keep);
      arc.sort(function (a, b) { return (a.archivedAt || '') < (b.archivedAt || '') ? 1 : -1; });
      groups = [{ key: 'archived', label: 'بایگانی‌شده', items: arc }];
    } else if (st.taskGroup === 'cat') {
      /* گروه‌بندی بر پایهٔ دسته — وقتی کارها را «موضوعی» می‌بینید نه
         «زمانی»: همهٔ مکاتبات اداری با هم، همهٔ بایگانی و اسکن با هم. */
      var byCat = {};
      var order = [];
      N.tasks({ status: 'open', archived: false }).filter(keep).forEach(function (t) {
        var k = t.category || '';
        if (!byCat[k]) { byCat[k] = []; order.push(k); }
        byCat[k].push(t);
      });
      /* ترتیب: اول دسته‌های تعریف‌شده به ترتیب خودشان، بعد هرچه در داده
         هست و در فهرست نیست، و ته صف بی‌دسته‌ها. */
      var known = N.categories().filter(function (c) { return byCat[c]; });
      var extra = order.filter(function (k) { return k && known.indexOf(k) < 0; });
      groups = known.concat(extra).map(function (k) {
        return { key: 'c', label: k, items: byCat[k] };
      });
      if (byCat['']) groups.push({ key: 'c', label: 'بدون دسته', items: byCat[''] });
    } else {
      groups = N.taskBuckets(base).map(function (b) {
        return { key: b.key, label: b.label, items: b.items.filter(keep) };
      });
    }

    var total = groups.reduce(function (n, b) { return n + b.items.length; }, 0);
    var s = N.stats();
    var nArchived = N.tasks({ archived: true }).length;
    var cats = N.taskCategories({ status: archived ? undefined : 'open',
      archived: archived });

    var filterRow = FILTERS.map(function (x) {
      return el('button.chip-btn' + (st.taskFilter === x.key ? '.on' : ''), {
        type: 'button', text: x.label,
        onclick: function () { st.taskFilter = x.key; app.render(); }
      });
    });
    if (nArchived) {
      filterRow.push(el('button.chip-btn' + (archived ? '.on' : ''), {
        type: 'button', text: 'بایگانی (' + fa(nArchived) + ')',
        title: 'کارهای بسته‌شده‌ای که کنار گذاشته‌اید',
        onclick: function () {
          st.taskFilter = archived ? 'all' : 'archived';
          app.render();
        }
      }));
    }
    filterRow.push(el('div.spacer'));
    if (!archived) {
      /* گروه‌بندی: زمانی یا موضوعی. هر دو بر یک دادهٔ واحد، فقط دو نگاه. */
      filterRow.push(el('div.task-group-switch', { role: 'group' }, [
        { k: 'due', t: 'بر پایهٔ سررسید' },
        { k: 'cat', t: 'بر پایهٔ دسته' }
      ].map(function (o) {
        return el('button.fm-btn' + (st.taskGroup === o.k ? '.on' : ''), {
          type: 'button', text: o.t,
          onclick: function () { st.taskGroup = o.k; app.render(); }
        });
      })));
    }
    filterRow.push(el('button.btn.small.primary', {
      type: 'button', text: '＋ کار تازه',
      onclick: function () { dialog(app, {}, refresh); }
    }));

    var head = el('header.wl-hero.task-hero', null, [
      el('div.wl-hero-date', { text: J.format(J.today(), { long: true }) }),
      el('h1.wl-hero-line', {
        text: archived
          ? fa(nArchived) + ' کار در بایگانی.'
          : (!s.openTasks ? 'کارِ بازی نمانده است.'
            : (s.overdueTasks
              ? fa(s.openTasks) + ' کار باز، که ' + fa(s.overdueTasks) + ' تای آن عقب افتاده.'
              : fa(s.openTasks) + ' کار باز، همه در مهلت.'))
      }),
      el('div.task-filters', null, filterRow),
      catBar(app, st, cats)
    ]);

    /* میان‌برهای ثبت سریع: همان کارهایی که هر روز تکرار می‌شوند، یک کلیک
       فاصله دارند. بدون پرونده ثبت می‌شوند چون از این صفحه معلوم نیست
       کدام پرونده مراد است. */
    var quickBar = archived ? null : el('div.task-quick', null,
      [el('span.muted.tiny', { text: 'ثبت سریع برای امروز:' })].concat(
        N.presets().map(function (p) {
          return el('button.chip-btn', {
            type: 'button', text: '＋ ' + p,
            onclick: function () { quickAdd(app, p, '', refresh); }
          });
        })
      ).concat([
        el('button.chip-btn.chip-add', {
          type: 'button', text: '＋ میان‌بر تازه',
          title: 'کاری که هر روز تکرار می‌شود، بهتر است دکمه داشته باشد',
          onclick: function () {
            askNewItem('میان‌بر تازه', 'TaskPresets', '',
              'به دکمه‌های ثبت سریع اضافه می‌شود.', refresh);
          }
        })
      ]));

    var body = el('div.task-buckets');
    groups.forEach(function (b) {
      if (!b.items.length) return;
      body.appendChild(el('section.task-bucket.b-' + b.key, null, [
        el('div.task-bucket-head', null, [
          el('h2', { text: b.label }),
          el('span.wl-count' + (b.key === 'overdue' ? '.late' : ''), {
            text: fa(b.items.length) + ' کار'
          })
        ]),
        el('ul.task-list', null, b.items.map(function (t) {
          return row(app, t, refresh);
        }))
      ]));
    });

    if (!total) {
      body.appendChild(el('div.empty-state', null, [
        el('p', {
          text: archived ? 'بایگانی خالی است.'
            : (st.taskFilter === 'all' && st.taskCat == null
              ? 'کاری ثبت نشده است. کارهای شفاهی و ارجاع‌های بیرون از پرونده را ' +
                'همین‌جا بنویسید تا فراموش نشوند.'
              : 'با این صافی کاری پیدا نشد.')
        }),
        archived ? null : el('button.btn.primary', {
          type: 'button', text: 'ثبت کار تازه',
          onclick: function () { dialog(app, {}, refresh); }
        })
      ]));
    }

    if (!archived) {
      var closed = N.tasks({ status: 'done' }).concat(N.tasks({ status: 'cancelled' }))
        .filter(keep);
      if (closed.length) {
        closed.sort(function (a, b) { return (a.doneAt || '') < (b.doneAt || '') ? 1 : -1; });
        var doneBox = el('details.task-done-box', null, [
          el('summary', { text: fa(closed.length) + ' کار بسته‌شده' })
        ]);
        /* فهرست بسته‌شده‌ها هر ماه بلندتر می‌شود تا جایی که کسی بازش
           نمی‌کند؛ یک دکمه، همه را یکجا کنار می‌گذارد. */
        doneBox.appendChild(el('div.task-archive-bar', null, [
          el('span.muted.tiny', {
            text: 'کارِ بسته‌شده هنوز در فهرست می‌ماند تا ببینیدش. وقتی دیگر ' +
              'لازم نبود، بایگانی‌اش کنید — از گزارش حذف نمی‌شود.'
          }),
          el('div.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: 'بایگانی همهٔ ' + fa(closed.length) + ' کار',
            onclick: function () {
              w.U.confirmBox('بایگانی کارهای بسته‌شده',
                fa(closed.length) + ' کار بایگانی می‌شود. از فهرست می‌روند ولی ' +
                'در گزارش و بایگانی می‌مانند.', 'بایگانی کن').then(function (ok) {
                  if (!ok) return;
                  N.archiveClosed().then(function (n) {
                    w.U.toast(fa(n) + ' کار بایگانی شد.', 'good');
                    refresh();
                  });
                });
            }
          })
        ]));
        doneBox.appendChild(el('ul.task-list', null, closed.slice(0, 60).map(function (t) {
          return row(app, t, refresh);
        })));
        body.appendChild(doneBox);
      }
    }

    if (!archived) body.appendChild(reportBlock(app));

    w.U.clear(mount);
    mount.appendChild(el('div.tasks-view', null, [head, quickBar, body]));
  }

  /** نوار دسته‌ها — صافی، نه گروه‌بندی؛ گروه‌بندی کلید جداگانه دارد */
  function catBar(app, st, cats) {
    if (!cats.length) return null;
    var bar = el('div.task-cats', null, [
      el('span.muted.tiny', { text: 'دسته:' }),
      el('button.chip-btn' + (st.taskCat == null ? '.on' : ''), {
        type: 'button', text: 'همه',
        onclick: function () { st.taskCat = null; app.render(); }
      })
    ]);
    cats.forEach(function (c) {
      bar.appendChild(el('button.chip-btn' + (st.taskCat === c.key ? '.on' : ''), {
        type: 'button', text: c.label + ' ' + fa(c.n),
        onclick: function () {
          st.taskCat = st.taskCat === c.key ? null : c.key;
          app.render();
        }
      }));
    });
    bar.appendChild(el('button.chip-btn.chip-add', {
      type: 'button', text: '＋ دسته',
      title: 'افزودن دستهٔ تازه به فهرست',
      onclick: function () {
        askNewItem('دستهٔ تازه', 'TaskCategories', '',
          'به فهرست دسته‌ها اضافه می‌شود.', function () { app.render(); });
      }
    }));
    return bar;
  }

  w.UITasks = {
    render: render, dialog: dialog, row: row, casePanel: casePanel,
    todaySection: todaySection, quickAdd: quickAdd, reportBlock: reportBlock
  };
})(window);
