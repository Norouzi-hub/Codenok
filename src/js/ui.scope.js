/*
 * دامنهٔ کار — «کدام پرونده‌ها مالِ من‌اند؟»
 *
 * این یک فیلتر نیست. فیلتر را هر بار، در هر صفحه، باید دوباره گذاشت؛
 * و همین بود که کاربر را اذیت می‌کرد: پرونده‌ای که به کارشناس دیگری
 * ارجاع شده دیگر کارِ او نیست، ولی در کارتابل و گزارش و تقویم می‌آمد و
 * هر بار باید دستی کنار گذاشته می‌شد.
 *
 * دامنه یک بار تعیین می‌شود و می‌مانَد. و چون ماندگار است، هیچ‌وقت پنهان
 * نمی‌شود: تا وقتی چیزی کنار گذاشته شده، چیپِ نوار بالا می‌گوید چند
 * پرونده و چرا، و با یک کلیک همه‌چیز برمی‌گردد. آماری که نمی‌دانی روی
 * چه چیزی حساب شده، بدتر از آمار اشتباه است.
 */
(function (w) {
  'use strict';

  var el = w.U.el, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }

  /** خلاصهٔ یک‌خطی دامنه، برای چیپ نوار بالا */
  function summary() {
    var sc = M.scope();
    var bits = [];
    if (sc.hideTransferred) bits.push('بدون ارجاع‌شده‌ها');
    if (sc.hideClosed) bits.push('بدون مختومه‌ها');
    if (sc.expert) bits.push('کارشناس: ' + sc.expert);
    return bits.join(' • ');
  }

  /** چیپ نوار بالا — فقط وقتی دامنه‌ای فعال است دیده می‌شود */
  function chip(app) {
    var node = el('button.scope-chip', {
      type: 'button',
      onclick: function () { dialog(app); }
    });
    refreshChip(node);
    node.refresh = function () { refreshChip(node); };
    return node;
  }

  function refreshChip(node) {
    var on = M.scopeIsOn();
    node.style.display = on ? '' : 'none';
    if (!on) return;
    var out = M.outOfScopeCount();
    w.U.clear(node);
    node.appendChild(el('span.scope-dot'));
    node.appendChild(el('span.scope-chip-text', { text: summary() }));
    node.appendChild(el('span.scope-chip-n', {
      text: out ? fa(out) + ' کنار' : 'چیزی کنار نرفته'
    }));
    node.title = 'دامنهٔ کار: ' + summary() + ' — ' +
      (out ? fa(out) + ' پرونده در هیچ شمارشی نمی‌آید.'
        : 'الان پرونده‌ای مشمولش نیست.') + ' برای تغییر کلیک کنید.';
  }

  /**
   * پنجرهٔ تنظیم دامنه.
   * هر گزینه می‌گوید چند پرونده را کنار می‌گذارد — پیش از اینکه بزنید.
   */
  function dialog(app) {
    var sc = M.scope();
    var next = {
      hideTransferred: sc.hideTransferred,
      hideClosed: sc.hideClosed,
      expert: sc.expert
    };
    var all = M.state.cases;
    var nTransferred = all.filter(function (c) { return !!c.transferDate; }).length;
    var nClosed = all.filter(function (c) { return /مختومه/.test(c.status || ''); }).length;

    var body = el('div.scope-dialog');
    body.appendChild(el('p.muted.tiny', {
      text: 'اینها از کارتابل، فهرست پرونده‌ها، گزارش‌ها و تقویم کنار گذاشته ' +
        'می‌شوند — نه پاک. خروجی اکسل و نسخهٔ پشتیبان همیشه همه‌چیز را دارند.'
    }));

    var countNode = el('div.scope-count');

    function toggle(key, label, hint, n) {
      var row = el('button.scope-opt' + (next[key] ? '.on' : ''), {
        type: 'button',
        onclick: function () {
          next[key] = !next[key];
          row.classList.toggle('on', next[key]);
          sync();
        }
      }, [
        el('span.scope-box', { html: '<span class="scope-tick">✓</span>' }),
        el('span.scope-opt-text', null, [
          el('b', { text: label }),
          el('span.muted.tiny', { text: hint })
        ]),
        el('span.scope-opt-n', { text: fa(n) + ' پرونده' })
      ]);
      return row;
    }

    body.appendChild(el('div.scope-opts', null, [
      toggle('hideTransferred', 'پرونده‌های ارجاع‌شده به کارشناس دیگر',
        'از دست دبیرخانهٔ شما خارج شده‌اند؛ نه مختومه‌اند نه در جریانِ شما.',
        nTransferred),
      toggle('hideClosed', 'پرونده‌های مختومه',
        'کارشان تمام شده. برای دیدن آمار تاریخی، روشنشان بگذارید.', nClosed)
    ]));

    var experts = M.distinct('expert');
    if (experts.length > 1) {
      var sel = el('select.input.small');
      sel.appendChild(el('option', { value: '', text: 'همهٔ کارشناسان' }));
      experts.forEach(function (x) {
        sel.appendChild(el('option', { value: x, text: x }));
      });
      sel.value = next.expert;
      sel.addEventListener('change', function () {
        next.expert = sel.value;
        sync();
      });
      body.appendChild(el('label.field.wide.scope-expert', null, [
        el('span.field-label', { text: 'فقط پرونده‌های این کارشناس' }), sel
      ]));
    }

    body.appendChild(countNode);

    function sync() {
      var kept = all.filter(function (c) {
        if (next.hideTransferred && c.transferDate) return false;
        if (next.hideClosed && /مختومه/.test(c.status || '')) return false;
        if (next.expert && (c.expert || '') !== next.expert) return false;
        return true;
      }).length;
      w.U.clear(countNode);
      countNode.appendChild(el('b', { text: fa(kept) }));
      countNode.appendChild(el('span', {
        text: ' پرونده در دامنه می‌ماند، ' + fa(all.length - kept) + ' کنار می‌رود.'
      }));
      countNode.classList.toggle('narrow', kept < all.length);
    }
    sync();

    var m;
    m = w.U.modal('دامنهٔ کار', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'برداشتن دامنه',
        title: 'همهٔ پرونده‌ها دوباره شمرده شوند',
        onclick: function () {
          apply(app, { hideTransferred: false, hideClosed: false, expert: '' }, m);
        }
      }),
      el('div.spacer'),
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'اعمال',
        onclick: function () { apply(app, next, m); }
      })
    ]);
    m.root.classList.add('scope-modal');
    return m;
  }

  function apply(app, patch, m) {
    M.setScope(patch).then(function () {
      if (m) m.close();
      app.render();
      w.U.toast(M.scopeIsOn()
        ? 'دامنه اعمال شد — ' + fa(M.outOfScopeCount()) + ' پرونده کنار گذاشته شد.'
        : 'دامنه برداشته شد؛ همهٔ پرونده‌ها دوباره شمرده می‌شوند.', 'good');
    });
  }

  /** نوار «اینها را نمی‌بینید» — بالای فهرست و گزارش */
  function banner(app) {
    if (!M.scopeIsOn()) return null;
    return el('div.scope-banner', null, [
      el('span.scope-dot'),
      el('span', null, [
        el('b', { text: fa(M.outOfScopeCount()) + ' پرونده' }),
        el('span', { text: ' بیرون از دامنهٔ کار است و در این صفحه شمرده نمی‌شود — ' }),
        el('span.scope-why', { text: summary() })
      ]),
      el('div.spacer'),
      el('button.btn.small.ghost', {
        type: 'button', text: 'تغییر دامنه',
        onclick: function () { dialog(app); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'نشان بده',
        title: 'دامنه را بردار تا همه‌چیز شمرده شود',
        onclick: function () {
          apply(app, { hideTransferred: false, hideClosed: false, expert: '' });
        }
      })
    ]);
  }

  w.UIScope = {
    chip: chip, dialog: dialog, banner: banner, summary: summary, apply: apply
  };
})(window);
