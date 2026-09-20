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

  /** پرونده را با شمارهٔ خودش پیدا می‌کند (همان چیزی که کاربر تایپ می‌کند) */
  function caseByNo(no) {
    var want = w.U.toLatinDigits(String(no || '')).trim();
    if (!want) return null;
    var found = null;
    M.state.cases.forEach(function (c) {
      if (w.U.toLatinDigits(c.caseNo || '').trim() === want) found = c;
    });
    return found;
  }

  function caseLabel(rec) {
    return w.U.toLatinDigits(rec.caseNo || '') + ' — ' + personOf(rec);
  }

  /* ================================================================
     پنجرهٔ ثبت / ویرایش کار
     ================================================================ */

  /**
   * dialog(app, o, onDone)
   * o: { task } برای ویرایش، یا { caseId } برای کارِ تازهٔ یک پرونده.
   */
  function dialog(app, o, onDone) {
    o = o || {};
    var task = o.task || null;
    var fixedCase = o.caseId || (task ? task.caseId : '');
    var lockCase = !!o.caseId && !task;      // از داخل پرونده باز شده

    var state = {
      title: task ? (task.title || '') : '',
      text: task ? (task.text || '') : '',
      followUp: task ? (task.followUp || '') : '',
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

    var chips = el('div.task-presets', null, N.presets().map(function (p) {
      return el('button.chip-btn', {
        type: 'button', text: p,
        onclick: function () {
          state.title = p;
          titleInput.value = p;
          titleInput.focus();
        }
      });
    }));

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
        placeholder: 'خالی بگذارید اگر کار به پرونده‌ای مربوط نیست'
      });
      var caseHint = el('span.muted.tiny');
      function syncCase() {
        var raw = caseInput.value.trim();
        if (!raw) {
          state.caseId = '';
          caseHint.textContent = 'کارِ بیرون از پرونده‌ها.';
          return;
        }
        var rec = caseByNo(raw.split('—')[0]);
        state.caseId = rec ? rec.id : '';
        caseHint.textContent = rec
          ? 'پرونده: ' + caseLabel(rec)
          : 'پرونده‌ای با این شماره پیدا نشد؛ کار بدون پرونده ثبت می‌شود.';
      }
      caseInput.addEventListener('input', syncCase);
      syncCase();
      body.appendChild(el('label.field.wide', null, [
        el('span.field-label', { text: 'پروندهٔ مربوط (اختیاری)' }),
        caseInput, caseHint
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
    var fromInput = el('input.input.small', {
      type: 'text', value: state.from,
      placeholder: 'چه کسی گفته؟ مثلاً: رئیس کمیته'
    });
    fromInput.addEventListener('input', function () { state.from = fromInput.value; });

    var ownerInput = el('input.input.small', {
      type: 'text', value: state.owner, placeholder: 'با چه کسی است؟'
    });
    ownerInput.addEventListener('input', function () { state.owner = ownerInput.value; });

    var catSelect = el('select.input.small');
    catSelect.appendChild(el('option', { value: '', text: '— بدون دسته —' }));
    N.categories().forEach(function (c) {
      catSelect.appendChild(el('option', {
        value: c, text: c, selected: c === state.category ? 'selected' : null
      }));
    });
    catSelect.value = state.category;
    catSelect.addEventListener('change', function () { state.category = catSelect.value; });

    body.appendChild(el('div.task-grid', null, [
      el('label.field', null, [
        el('span.field-label', { text: 'ارجاع‌دهنده' }), fromInput
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'مسئول انجام' }), ownerInput
      ]),
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
      (late ? '.is-late' : '') + (task.priority === 'urgent' ? '.is-urgent' : '');

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
    if (task.from) meta.push(el('span.task-from', { text: 'از: ' + task.from }));
    if (task.category) meta.push(el('span.task-cat', { text: task.category }));
    if (cancelled) {
      meta.push(el('span.task-cancel-why', {
        text: 'لغو شد' + (task.cancelReason ? ' — ' + task.cancelReason : '')
      }));
    }

    var actions = el('div.task-actions', null, [
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
    var refresh = function () { app.render(); };

    var f = {};
    if (st.taskFilter === 'standalone') f.standalone = true;
    var buckets = N.taskBuckets(f).map(function (b) {
      return {
        key: b.key, label: b.label,
        items: b.items.filter(function (t) {
          if (st.taskFilter === 'oncase') return !!t.caseId;
          if (st.taskFilter === 'urgent') return t.priority === 'urgent';
          return true;
        })
      };
    });
    var total = buckets.reduce(function (n, b) { return n + b.items.length; }, 0);
    var s = N.stats();

    var head = el('header.wl-hero.task-hero', null, [
      el('div.wl-hero-date', { text: J.format(J.today(), { long: true }) }),
      el('h1.wl-hero-line', {
        text: !s.openTasks ? 'کارِ بازی نمانده است.'
          : (s.overdueTasks
            ? fa(s.openTasks) + ' کار باز، که ' + fa(s.overdueTasks) + ' تای آن عقب افتاده.'
            : fa(s.openTasks) + ' کار باز، همه در مهلت.')
      }),
      el('div.task-filters', null, FILTERS.map(function (x) {
        return el('button.chip-btn' + (st.taskFilter === x.key ? '.on' : ''), {
          type: 'button', text: x.label,
          onclick: function () { st.taskFilter = x.key; app.render(); }
        });
      }).concat([
        el('div.spacer'),
        el('button.btn.small.primary', {
          type: 'button', text: '＋ کار تازه',
          onclick: function () { dialog(app, {}, refresh); }
        })
      ]))
    ]);

    /* میان‌برهای ثبت سریع: همان کارهایی که هر روز تکرار می‌شوند، یک کلیک
       فاصله دارند. بدون پرونده ثبت می‌شوند چون از این صفحه معلوم نیست
       کدام پرونده مراد است. */
    var quickBar = el('div.task-quick', null,
      [el('span.muted.tiny', { text: 'ثبت سریع برای امروز:' })].concat(
        N.presets().map(function (p) {
          return el('button.chip-btn', {
            type: 'button', text: '＋ ' + p,
            onclick: function () { quickAdd(app, p, '', refresh); }
          });
        })
      ));

    var body = el('div.task-buckets');
    buckets.forEach(function (b) {
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
          text: st.taskFilter === 'all'
            ? 'کاری ثبت نشده است. کارهای شفاهی و ارجاع‌های بیرون از پرونده را ' +
              'همین‌جا بنویسید تا فراموش نشوند.'
            : 'با این صافی کاری پیدا نشد.'
        }),
        el('button.btn.primary', {
          type: 'button', text: 'ثبت کار تازه',
          onclick: function () { dialog(app, {}, refresh); }
        })
      ]));
    }

    var closed = N.tasks({ status: 'done' }).concat(N.tasks({ status: 'cancelled' }));
    if (closed.length) {
      closed.sort(function (a, b) { return (a.doneAt || '') < (b.doneAt || '') ? 1 : -1; });
      var doneBox = el('details.task-done-box', null, [
        el('summary', { text: fa(closed.length) + ' کار بسته‌شده' })
      ]);
      doneBox.appendChild(el('ul.task-list', null, closed.slice(0, 60).map(function (t) {
        return row(app, t, refresh);
      })));
      body.appendChild(doneBox);
    }

    body.appendChild(reportBlock(app));

    w.U.clear(mount);
    mount.appendChild(el('div.tasks-view', null, [head, quickBar, body]));
  }

  w.UITasks = {
    render: render, dialog: dialog, row: row, casePanel: casePanel,
    todaySection: todaySection, quickAdd: quickAdd, reportBlock: reportBlock
  };
})(window);
