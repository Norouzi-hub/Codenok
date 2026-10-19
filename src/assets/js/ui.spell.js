/*
 * غلط‌یاب — رابط.
 *
 * attach(textarea) یک نوارِ کوچک زیرِ متن می‌گذارد: «✓ بی‌غلط» یا «۳ غلط ·
 * ۱ نگارشی»، و دکمهٔ «اصلاح نگارشی». با زدنِ شمار، فهرستِ موارد باز می‌شود:
 * هر واژه با جمله‌اش، پیشنهادها (یک کلیک = جایگزینی)، «نادیده» و «افزودن به
 * واژه‌نامه». کلیک روی خودِ واژه، همان‌جا را در متن انتخاب می‌کند.
 *
 * جایگزینی رویدادِ input می‌فرستد؛ پس هرکه متن را نگه می‌دارد (فرم، مینوت)
 * همان‌طور باخبر می‌شود که از تایپِ کاربر.
 *
 * guard(textarea, کار) پیش از چاپ و کپی می‌پرسد اگر غلطی مانده باشد.
 */
(function (w) {
  'use strict';

  var el = w.U.el;
  function fa(n) { return w.U.toFaDigits(n); }
  function S() { return w.Spell; }

  function context(text, s, e) {
    var a = Math.max(0, s - 28), b = Math.min(text.length, e + 28);
    return {
      before: (a > 0 ? '…' : '') + text.slice(a, s).replace(/\s+/g, ' '),
      word: text.slice(s, e),
      after: text.slice(e, b).replace(/\s+/g, ' ') + (b < text.length ? '…' : '')
    };
  }

  function attach(ta, opts) {
    opts = opts || {};
    if (!S() || !S().ready() || !S().enabled()) return null;
    var ignore = new Set();
    var issues = [];
    var open = false, undo = null, undoTimer = null;

    var bar = el('div.sp-bar' + (opts.compact ? '.is-compact' : ''));
    var status = el('button.sp-status', { type: 'button' });
    var fixBtn = el('button.linkish.tiny.sp-clean', {
      type: 'button', text: 'اصلاح نگارشی',
      title: 'نیم‌فاصله، «ی» و «ک» فارسی، فاصله و نشانه‌گذاری — یک‌جا'
    });
    var undoBtn = el('button.linkish.tiny.sp-undo', { type: 'button', text: '↶ بازگرداندن' });
    undoBtn.style.display = 'none';
    var note = el('span.sp-note');
    bar.appendChild(status);
    bar.appendChild(note);
    bar.appendChild(el('span.spacer'));
    bar.appendChild(undoBtn);
    bar.appendChild(fixBtn);
    var panel = el('div.sp-panel');
    panel.style.display = 'none';
    var box = el('div.sp-box', null, [bar, panel]);
    // داخلِ برچسبِ فیلد است: کلیک روی فهرست نباید فوکوس را به متن بپرد
    box.addEventListener('click', function (e) {
      if (!e.target.closest('button, input')) e.preventDefault();
    });

    function setValue(v) {
      ta.value = v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function refresh() {
      issues = S().check(ta.value || '', ignore);
      var errs = issues.filter(function (i) { return i.kind !== 'style'; }).length;
      var style = issues.length - errs;
      status.className = 'sp-status' + (errs ? ' is-bad' : (style ? ' is-style' : ' is-ok'));
      status.textContent = !issues.length ? '✓ غلط تایپی پیدا نشد'
        : [errs ? fa(errs) + ' غلط احتمالی' : '', style ? fa(style) + ' نکتهٔ نگارشی' : '']
          .filter(Boolean).join(' · ') + (open ? ' ▴' : ' ▾');
      status.disabled = !issues.length;
      bar.classList.toggle('has-issues', issues.length > 0);
      if (!issues.length) open = false;
      drawPanel();
      if (opts.onChange) opts.onChange(issues);
    }

    function select(i) {
      ta.focus();
      try { ta.setSelectionRange(i.start, i.end); } catch (e) { /* بعضی ورودی‌ها */ }
      // متنِ بلند: واژه را در دیدرس بیاور
      var lines = ta.value.slice(0, i.start).split('\n').length - 1;
      var lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
      ta.scrollTop = Math.max(0, lines * lh - ta.clientHeight / 2);
    }

    function replace(i, sug) {
      var v = ta.value;
      if (v.slice(i.start, i.end) !== i.word) { refresh(); return; }
      setValue(v.slice(0, i.start) + sug + v.slice(i.end));
      refresh();
    }

    function drawPanel() {
      w.U.clear(panel);
      panel.style.display = open && issues.length ? '' : 'none';
      if (!open) return;
      var text = ta.value;
      issues.slice(0, 60).forEach(function (i) {
        var c = context(text, i.start, i.end);
        var row = el('div.sp-row.is-' + i.kind, null, [
          el('button.sp-ctx', { type: 'button', title: 'نشان دادن در متن', onclick: function () { select(i); } }, [
            el('span', { text: c.before }), el('mark', { text: c.word }), el('span', { text: c.after })
          ]),
          el('div.sp-row-foot', null, [
            el('span.sp-msg', { text: i.msg }),
            el('div.sp-sugs', null, i.suggestions.length
              ? i.suggestions.map(function (s) {
                return el('button.sp-sug', { type: 'button', text: s, title: 'جایگزینی با «' + s + '»',
                  onclick: function () { replace(i, s); } });
              })
              : [el('span.muted.tiny', { text: 'پیشنهادی نیست' })]),
            el('span.spacer'),
            el('button.linkish.tiny', { type: 'button', text: 'نادیده',
              title: 'در همین متن دیگر گفته نشود',
              onclick: function () { ignore.add(i.key); refresh(); } }),
            i.kind === 'error' && i.msg !== 'واژهٔ تکراری' ? el('button.linkish.tiny', {
              type: 'button', text: 'افزودن به واژه‌نامه',
              title: 'این واژه درست است — دیگر هیچ‌جا غلط شمرده نشود',
              onclick: function () {
                S().addWord(i.word).then(function () {
                  refresh();
                  w.U.toast('«' + i.word + '» به واژه‌نامهٔ شما افزوده شد.', 'good');
                });
              }
            }) : null
          ])
        ]);
        panel.appendChild(row);
      });
      if (issues.length > 60) {
        panel.appendChild(el('p.muted.tiny', { text: fa(issues.length - 60) + ' مورد دیگر — بعد از اصلاحِ این‌ها نشان داده می‌شوند.' }));
      }
    }

    status.addEventListener('click', function () { open = !open; refresh(); });
    fixBtn.addEventListener('click', function () {
      var before = ta.value;
      var r = S().cleanup(before);
      if (!r.changes || r.text === before) {
        w.U.toast('نکتهٔ نگارشی‌ای برای اصلاح نبود.', 'good');
        return;
      }
      undo = before;
      setValue(r.text);
      refresh();
      note.textContent = fa(r.changes) + ' اصلاح نگارشی انجام شد';
      undoBtn.style.display = '';
      clearTimeout(undoTimer);
      undoTimer = setTimeout(function () { undoBtn.style.display = 'none'; note.textContent = ''; undo = null; }, 20000);
    });
    undoBtn.addEventListener('click', function () {
      if (undo == null) return;
      setValue(undo);
      undo = null;
      undoBtn.style.display = 'none';
      note.textContent = '';
      refresh();
    });

    var timer = null;
    ta.addEventListener('input', function (e) {
      if (!e.isTrusted) return;           // جایگزینیِ خودمان همان‌جا refresh می‌کند
      clearTimeout(timer);
      timer = setTimeout(refresh, 450);
    });
    ta.addEventListener('focus', function () { box.classList.add('is-focus'); });
    ta.addEventListener('blur', function () { box.classList.remove('is-focus'); });

    var ctl = {
      node: box, refresh: refresh,
      issues: function () { return issues; },
      errors: function () { return issues.filter(function (i) { return i.kind !== 'style'; }); },
      open: function () { open = true; refresh(); }
    };
    ta._spell = ctl;
    // اولین وارسی بعد از ساختِ صفحه، تا باز شدنِ پنجره کُند نشود
    setTimeout(refresh, opts.delay == null ? 60 : opts.delay);
    return box;
  }

  /**
   * پیش از چاپ، کپی و ورد: غلطی مانده؟ می‌پرسد، نه اینکه جلو را بگیرد.
   * resolve(true) یعنی ادامه.
   */
  function guard(ta, action) {
    var ctl = ta && ta._spell;
    if (!ctl || !S().askBefore()) return Promise.resolve(true);
    ctl.refresh();
    var errs = ctl.errors();
    if (!errs.length) return Promise.resolve(true);
    var sample = errs.slice(0, 4).map(function (i) { return '«' + i.word + '»'; }).join('، ');
    return w.U.confirmBox('غلط تایپی در متن مانده',
      fa(errs.length) + ' غلط احتمالی: ' + sample + (errs.length > 4 ? ' و …' : '') +
      '. با همین متن ' + (action || 'ادامه') + '؟', 'بله، ادامه').then(function (ok) {
      if (!ok) { ctl.open(); var first = errs[0]; ta.focus(); try { ta.setSelectionRange(first.start, first.end); } catch (e) { /* */ } }
      return ok;
    });
  }

  /** بلوکِ تنظیمات: روشن/خاموش، پرسیدن پیش از چاپ، و واژه‌نامهٔ کاربر */
  function settingsBlock(app) {
    if (!S() || !S().ready()) return null;
    function check(label, on, fn, title) {
      var b = el('input', { type: 'checkbox' });
      b.checked = on;
      b.addEventListener('change', function () { fn(b.checked); });
      return el('label.act-check', { title: title || '' }, [b, el('span', { text: label })]);
    }
    var words = el('textarea.input.area.sp-words', {
      rows: 4, dir: 'rtl', value: S().userWords().join('\n'),
      placeholder: 'هر واژه در یک سطر — نام‌ها، اصطلاح‌ها و واژه‌هایی که درست‌اند'
    });
    return el('div.sp-settings', null, [
      el('p.muted.tiny', {
        text: 'زیرِ متنِ مینوت، فرم‌های نامه و فیلدهای متنیِ پرونده، غلط‌های تایپی، حرفِ عربی و ' +
          'شکلِ نادرستِ اداری (رییس، هیات، احتراما) گفته می‌شود. نام‌ها و واحدهای ثبت‌شده در پرونده‌ها ' +
          'خودبه‌خود درست شمرده می‌شوند. واژه‌نامه: «لیلک» (Apache-2.0)، بی‌شبکه.'
      }),
      check('غلط‌یاب روشن باشد', S().enabled(), function (on) {
        S().setOption({ off: !on }).then(function () { w.U.toast(on ? 'غلط‌یاب روشن شد.' : 'غلط‌یاب خاموش شد.', 'good'); });
      }),
      check('پیش از چاپ، کپی و ورد، اگر غلطی مانده بپرس', S().askBefore(), function (on) {
        S().setOption({ ask: on });
      }),
      el('label.field', null, [
        el('span.field-label', { text: 'واژه‌نامهٔ من (' + fa(S().userWords().length) + ' واژه)' }),
        words
      ]),
      el('button.btn.small', {
        type: 'button', text: 'ذخیرهٔ واژه‌نامه',
        onclick: function () {
          S().setWords(words.value.split(/\n+/)).then(function () {
            w.U.toast('واژه‌نامه ذخیره شد: ' + fa(S().userWords().length) + ' واژه.', 'good');
          });
        }
      })
    ]);
  }

  w.UISpell = { attach: attach, guard: guard, settingsBlock: settingsBlock };
})(window);
