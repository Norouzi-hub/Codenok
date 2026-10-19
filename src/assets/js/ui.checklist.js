/*
 * نمای چک‌لیست مرحله‌ای.
 *
 * یک موتور، چهار نما — و هر چهار از یک جا می‌خوانند:
 *
 *   block   — چک‌لیستِ کامل، بالای تب «کارها» در صفحهٔ پرونده
 *   line    — همان چک‌لیست، جمع‌شده در یک سطر، برای صفحهٔ کارها
 *   chip    — «۳ از ۵» کنار ریل گردش‌کار
 *   warn    — هشدارِ کارِ الزامیِ مانده از مرحلهٔ قبل
 *
 * چرا «یک سطر» در صفحهٔ کارها: سی پرونده × پنج کار یعنی صد و پنجاه سطر،
 * و آن صفحه دیگر به درد نمی‌خورد. چک‌لیست یک چیز است، پس یک سطر است؛ باز
 * که کنی، کارهایش داخلش‌اند.
 */
(function (w) {
  'use strict';

  var el = w.U.el, M = w.Model, C = w.Checklist;

  function fa(n) { return w.U.toFaDigits(n); }

  /* ------------------------------------------------------------ اقدام */
  /*
   * دکمهٔ هر آیتم، همان سه جنسِ دکمهٔ آلارم است. تفاوتش این است که از
   * صفحهٔ کارها هم زده می‌شود، جایی که فرم پرونده باز نیست — پس برای
   * «رفتن سرِ فیلد» اول باید پرونده باز شود.
   */
  var CTA_LABEL = {
    upload: 'بارگذاری', form: 'ساختن فرم', field: 'تکمیل'
  };

  function ctaButton(app, rec, task, refresh) {
    var c = task.cta;
    if (!c || !c.type || task.status !== 'open') return null;
    var label = CTA_LABEL[c.type] || '';
    if (c.type === 'upload' && c.kind) label = 'بارگذاری ' + c.kind;
    if (c.type === 'form') label = 'ساختن فرم';
    return el('button.btn.small.ghost.cl-do', {
      type: 'button', text: label,
      title: 'همین‌جا انجامش بدهید؛ تیکش خودش می‌خورد',
      onclick: function (e) {
        e.stopPropagation();
        runCta(app, rec, task, refresh);
      }
    });
  }

  function runCta(app, rec, task, refresh) {
    var c = task.cta || {};
    if (c.type === 'upload') {
      w.UIDocs.addFrom(rec, function () {
        C.hit(rec, 'upload', c.kind).then(refresh);
      }, { kind: c.kind });
      return;
    }
    if (c.type === 'form') {
      var form = null;
      w.UILetters.FORMS.forEach(function (f) { if (f.key === c.form) form = f; });
      if (form) w.UILetters.formDialog(app, rec, form);
      return;
    }
    if (c.type === 'field') {
      /* ممکن است از صفحهٔ کارها زده شده باشد؛ آن‌وقت اول باید پرونده
         باز شود و بعد سراغ فیلد رفت. */
      if (app.state.view === 'case' && app.state.caseId === rec.id && app.jumpField) {
        app.jumpField(c.field);
        return;
      }
      app.state.formTab = 'case';
      app.openCase(rec.id);
      setTimeout(function () {
        if (app.jumpField) app.jumpField(c.field);
      }, 420);
    }
  }

  /* ----------------------------------------------------------- یک آیتم */
  function taskRow(app, group, task, refresh) {
    var rec = group.rec;
    var state = task.status === 'open' ? 'open' : task.status;
    var mark = el('span.cl-mark.is-' + state, {
      text: state === 'done' ? '✓' : (state === 'open' ? '' : '–'),
      'aria-hidden': 'true'
    });

    var actions = el('div.cl-actions');
    if (state === 'open') {
      // هر آیتمی دکمهٔ اقدام ندارد («پوشه کردن پرونده» کارِ دست است)
      var cta = ctaButton(app, rec, task, refresh);
      if (cta) actions.appendChild(cta);
      actions.appendChild(el('button.btn.small.cl-tick', {
        type: 'button', text: 'انجام شد',
        onclick: function (e) {
          e.stopPropagation();
          w.Notes.complete(task).then(refresh);
        }
      }));
      actions.appendChild(el('button.linkish.tiny', {
        type: 'button', text: 'لازم نبود',
        title: 'این کار برای این پرونده پیش نیامد — بسته می‌شود ولی ' +
          '«انجام‌شده» شمرده نمی‌شود',
        onclick: function (e) {
          e.stopPropagation();
          w.Notes.skipTask(task, '').then(refresh);
        }
      }));
    } else {
      actions.appendChild(el('button.linkish.tiny', {
        type: 'button', text: 'برگرداندن',
        onclick: function (e) {
          e.stopPropagation();
          w.Notes.reopen(task).then(refresh);
        }
      }));
    }

    return el('li.cl-item.is-' + state, null, [
      mark,
      el('div.cl-body', null, [
        el('span.cl-title', { text: task.title }),
        task.optional ? el('span.cl-opt', { text: 'اختیاری' }) : null,
        state === 'skipped' ? el('span.cl-note', {
          text: task.cancelReason ? 'لازم نبود — ' + task.cancelReason : 'لازم نبود'
        }) : null,
        state === 'done' && task.doneAt ? el('span.cl-note', {
          text: 'انجام شد — ' + w.J.format(task.doneAt)
        }) : null
      ]),
      el('div.spacer'),
      actions
    ]);
  }

  /* ------------------------------------------------------- نوار پیشرفت */
  function dots(group) {
    var box = el('span.cl-dots', { title: fa(group.settled) + ' از ' + fa(group.total) });
    group.tasks.forEach(function (t) {
      box.appendChild(el('span.cl-dot.is-' +
        (t.status === 'open' ? 'open' : (t.status === 'done' ? 'done' : 'skip'))));
    });
    return box;
  }

  function countText(group) {
    return fa(group.settled) + ' از ' + fa(group.total);
  }

  /* ------------------------------------------- چک‌لیست کامل (صفحهٔ پرونده) */
  function groupBox(app, group, refresh, opts) {
    opts = opts || {};
    var open = !group.complete || opts.open;
    var list = el('ul.cl-list', null, group.tasks.map(function (t) {
      return taskRow(app, group, t, refresh);
    }));

    var head = el('div.cl-head', null, [
      el('h4', { text: group.label }),
      dots(group),
      el('span.cl-count', { text: countText(group) }),
      group.complete ? el('span.cl-done-tag', { text: 'تمام شد' }) : null,
      el('div.spacer'),
      group.open ? el('button.linkish.tiny', {
        type: 'button', text: 'لازم نبود (کل چک‌لیست)',
        title: 'همهٔ کارهای ماندهٔ این چک‌لیست کنار گذاشته می‌شوند',
        onclick: function () {
          w.U.confirmBox('کنار گذاشتن چک‌لیست',
            'همهٔ ' + fa(group.open) + ' کارِ ماندهٔ «' + group.label +
            '» کنار گذاشته شود؟ دوباره هم ساخته نمی‌شود.',
            'کنار بگذار').then(function (ok) {
              if (ok) C.dismiss(group).then(refresh);
            });
        }
      }) : null
    ]);

    var box = el('details.cl-group' + (group.complete ? '.is-complete' : ''),
      { open: open });
    box.appendChild(el('summary', null, [head]));
    if (group.hint) box.appendChild(el('p.cl-hint', { text: group.hint }));
    box.appendChild(list);
    return box;
  }

  /** همهٔ چک‌لیست‌های یک پرونده — بالای تب «کارها و یادداشت‌ها» */
  function block(app, rec, refresh) {
    if (!rec || !rec.id) return null;
    var list = C.groups(rec.id);
    if (!list.length) return null;
    var cur = C.dueTemplate(rec);
    var wrap = el('section.cl-block');
    wrap.appendChild(el('h3.note-part-head', { text: 'چک‌لیست مرحله' }));
    list.forEach(function (g) {
      wrap.appendChild(groupBox(app, g, refresh, {
        open: cur && g.key === cur.key
      }));
    });
    return wrap;
  }

  /* ------------------------------------------------ یک سطر (صفحهٔ کارها) */
  function line(app, group, refresh) {
    var rec = group.rec;
    var box = el('details.cl-line' + (group.complete ? '.is-complete' : ''));
    /* از همین سطر باید معلوم باشد چک‌لیستِ کدام پرونده است — شماره، نام
       کارمند و واحد — بی‌آنکه لازم باشد بازش کنید یا به پرونده بروید. */
    var who = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    var unit = rec.orgUnit || rec.servicePlace || '';
    box.appendChild(el('summary.cl-line-head', null, [
      el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') }),
      el('span.cl-line-case', null, [
        el('b.cl-line-who', { text: who || 'بی‌نام' }),
        unit ? el('span.cl-line-unit', { text: unit }) : null
      ]),
      el('span.cl-line-label', { text: group.label }),
      dots(group),
      el('span.cl-count', { text: countText(group) }),
      group.openRequired
        ? el('span.cl-left', { text: fa(group.openRequired) + ' مانده' })
        : (group.complete ? el('span.cl-done-tag', { text: 'تمام شد' }) : null),
      el('div.spacer'),
      el('button.linkish.tiny', {
        type: 'button', text: 'پرونده ←',
        onclick: function (e) {
          e.preventDefault();
          e.stopPropagation();
          app.state.formTab = '__notes';
          app.openCase(rec.id);
        }
      })
    ]));
    box.appendChild(el('ul.cl-list', null, group.tasks.map(function (t) {
      return taskRow(app, group, t, refresh);
    })));
    return box;
  }

  /* ------------------------------------------------- چیپِ کنار ریل */
  function chip(app, rec) {
    var g = C.current(rec);
    if (!g) return null;
    return el('button.cl-chip' + (g.complete ? '.is-complete' : ''), {
      type: 'button',
      title: 'چک‌لیست «' + g.label + '» — ' + countText(g),
      onclick: function () {
        app.state.formTab = '__notes';
        app.openCase(rec.id);
      }
    }, [
      el('span', { text: g.label }),
      dots(g),
      el('span.cl-count', { text: countText(g) })
    ]);
  }

  /* ------------------------------------------------------ هشدار، نه سد */
  /*
   * کارِ الزامیِ ماندهٔ مرحله‌های قبل. عمداً فقط هشدار است: کار اداری
   * همیشه مرتب جلو نمی‌رود و سدِ سفت باعث می‌شود کاربر دورش بزند.
   */
  function warn(app, rec, refresh) {
    var left = C.pending(rec);
    if (!left.length) return null;
    var names = left.slice(0, 3).map(function (p) { return p.task.title; });
    return el('div.case-next.cl-warn', null, [
      el('span.case-next-label', { text: 'از مرحلهٔ قبل مانده' }),
      el('div.case-next-text', null, [
        el('span.case-next-meta', {
          text: fa(left.length) + ' کارِ الزامی: ' + names.join('، ') +
            (left.length > names.length ? ' و…' : '')
        }),
        el('span.case-next-auto', {
          text: 'جلوی کار را نمی‌گیرد؛ فقط یادآوری است که از قلم نیفتد.'
        })
      ]),
      el('div.spacer'),
      el('button.btn.small.ghost', {
        type: 'button', text: 'دیدن چک‌لیست',
        onclick: function () {
          app.state.formTab = '__notes';
          app.openCase(rec.id);
        }
      })
    ]);
  }

  /** همهٔ چک‌لیست‌های بازِ دامنهٔ کار — برای صفحهٔ کارها */
  function openGroups() {
    var out = [];
    M.scoped().forEach(function (rec) {
      C.groups(rec.id).forEach(function (g) {
        if (!g.complete) out.push(g);
      });
    });
    out.sort(function (a, b) {
      if (!!a.openRequired !== !!b.openRequired) return a.openRequired ? -1 : 1;
      return b.open - a.open;
    });
    return out;
  }

  w.UIChecklist = {
    block: block, line: line, chip: chip, warn: warn,
    groupBox: groupBox, taskRow: taskRow, dots: dots,
    openGroups: openGroups, runCta: runCta
  };
})(window);
