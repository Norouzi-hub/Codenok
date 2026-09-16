/* صفحهٔ قفل و مدیریت رمز عبور */
(function (w) {
  'use strict';

  var el = w.U.el;
  var overlay = null;

  function strength(pw) {
    var score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^\w\s]/.test(pw)) score++;
    return score;
  }

  function strengthLabel(score) {
    return ['خیلی ضعیف', 'ضعیف', 'متوسط', 'خوب', 'قوی', 'خیلی قوی'][score] || '';
  }

  /** صفحهٔ قفل تمام‌صفحه؛ تا رمز درست وارد نشود چیزی از داده‌ها دیده نمی‌شود */
  function showLock(onUnlock) {
    hide();
    var input = el('input.input.lock-input', {
      type: 'password', autocomplete: 'current-password',
      placeholder: 'رمز عبور', autofocus: true
    });
    var msg = el('div.lock-msg');
    var busy = false;

    function attempt() {
      if (busy) return;
      var pw = input.value;
      if (!pw) { input.focus(); return; }
      busy = true;
      btn.textContent = 'در حال بررسی…';
      msg.textContent = '';
      msg.className = 'lock-msg';
      // بررسی رمز عمداً کند است (۳۱۰٬۰۰۰ دور PBKDF2) تا حدس زدن سخت شود
      w.Store.unlock(pw).then(function (ok) {
        busy = false;
        btn.textContent = 'ورود';
        if (ok) { hide(); onUnlock(); return; }
        msg.textContent = 'رمز عبور نادرست است.';
        msg.className = 'lock-msg bad';
        input.value = '';
        input.focus();
      }).catch(function (e) {
        busy = false;
        btn.textContent = 'ورود';
        msg.textContent = 'خطا: ' + e.message;
        msg.className = 'lock-msg bad';
      });
    }

    var btn = el('button.btn.primary.block', {
      type: 'button', text: 'ورود', onclick: attempt
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); attempt(); }
    });

    overlay = el('div.lock-screen', null, [
      el('div.lock-box', null, [
        el('div.lock-logo', { text: '🔒' }),
        el('h1', { text: 'سامانهٔ پرونده‌ها' }),
        el('p.muted', { text: 'برای دیدن اطلاعات، رمز عبور را وارد کنید.' }),
        input, msg, btn,
        el('p.lock-note', {
          text: 'اطلاعات با همین رمز رمزنگاری شده‌اند. اگر رمز را فراموش کنید ' +
            'هیچ راهی برای بازیابی وجود ندارد.'
        })
      ])
    ]);
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); }, 50);
  }

  function hide() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function isShowing() { return !!overlay; }

  // ------------------------------------------------------ تعیین/تغییر رمز
  function passwordDialog(app, onDone) {
    var enabled = w.Store.status().encrypted;
    var current = el('input.input', { type: 'password', autocomplete: 'current-password' });
    var pw1 = el('input.input', { type: 'password', autocomplete: 'new-password' });
    var pw2 = el('input.input', { type: 'password', autocomplete: 'new-password' });
    var meter = el('div.pw-meter');
    var msg = el('div.lock-msg');

    pw1.addEventListener('input', function () {
      var sc = strength(pw1.value);
      w.U.clear(meter);
      if (!pw1.value) return;
      meter.appendChild(el('span.pw-bar', null, [
        el('span.pw-fill.s' + sc, { style: 'width:' + ((sc / 5) * 100) + '%' })
      ]));
      meter.appendChild(el('span.pw-label', { text: strengthLabel(sc) }));
    });

    var body = el('div.pw-dialog');
    if (enabled) {
      body.appendChild(el('label.field', null, [
        el('span.field-label', { text: 'رمز فعلی' }), current
      ]));
    }
    body.appendChild(el('label.field', null, [
      el('span.field-label', { text: enabled ? 'رمز جدید' : 'رمز عبور' }), pw1
    ]));
    body.appendChild(meter);
    body.appendChild(el('label.field', null, [
      el('span.field-label', { text: 'تکرار رمز' }), pw2
    ]));
    body.appendChild(msg);
    body.appendChild(el('div.warn', null, [
      el('span', null, [
        el('b', { text: 'این رمز قابل بازیابی نیست. ' }),
        el('span', {
          text: 'پرونده‌ها، تاریخچه و فهرست مستندات با آن رمزنگاری می‌شوند. ' +
            'اگر فراموشش کنید، داده‌ها از دست می‌روند. جایی امن یادداشتش کنید.'
        })
      ])
    ]));
    body.appendChild(el('p.muted.tiny', {
      text: 'توجه: فایل‌های پیوست (PDF و تصویر) داخل پوشهٔ مستندات رمز نمی‌شوند؛ ' +
        'حفاظت از آنها با دسترسی‌های ویندوز یا مک است. خروجی اکسل هم رمز ندارد.'
    }));

    var m, busy = false;
    function fail(text) {
      msg.textContent = text;
      msg.className = 'lock-msg bad';
      busy = false;
      save.textContent = 'ذخیرهٔ رمز';
    }

    var save = el('button.btn.primary', {
      type: 'button', text: 'ذخیرهٔ رمز',
      onclick: function () {
        if (busy) return;
        if (pw1.value.length < 6) { fail('رمز باید دست‌کم ۶ نویسه باشد.'); return; }
        if (pw1.value !== pw2.value) { fail('رمز و تکرارش یکی نیستند.'); return; }
        busy = true;
        save.textContent = 'در حال رمزنگاری…';
        var check = enabled
          ? w.Vault.unlock(current.value)
          : Promise.resolve(true);
        check.then(function (ok) {
          if (!ok) { fail('رمز فعلی نادرست است.'); return null; }
          return w.Store.setPassword(pw1.value).then(function () {
            m.close();
            w.U.toast('رمز عبور تنظیم شد و داده‌ها رمزنگاری شدند.', 'good');
            if (onDone) onDone();
          });
        }).catch(function (e) { fail('خطا: ' + e.message); });
      }
    });

    var footer = [
      el('button.btn.ghost', { type: 'button', text: 'انصراف',
        onclick: function () { m.close(); } })
    ];
    if (enabled) {
      footer.push(el('button.btn.ghost.danger', {
        type: 'button', text: 'برداشتن رمز',
        onclick: function () {
          w.Vault.unlock(current.value).then(function (ok) {
            if (!ok) { fail('رمز فعلی نادرست است.'); return; }
            return w.U.confirmBox('برداشتن رمز عبور',
              'پس از این، هر کسی که به این رایانه دسترسی داشته باشد می‌تواند ' +
              'اطلاعات را ببیند. مطمئنید؟', 'بردار').then(function (yes) {
                if (!yes) return;
                return w.Store.clearPassword().then(function () {
                  m.close();
                  w.U.toast('رمز برداشته شد و داده‌ها رمزگشایی شدند.', 'good');
                  if (onDone) onDone();
                });
              });
          });
        }
      }));
    }
    footer.push(save);

    m = w.U.modal(enabled ? 'تغییر رمز عبور' : 'تعیین رمز عبور', body, footer);
    setTimeout(function () { (enabled ? current : pw1).focus(); }, 50);
  }

  /** درخواست رمز برای باز کردن یک نسخهٔ پشتیبان رمزشده */
  function askBackupPassword(fileName) {
    return new Promise(function (resolve) {
      var input = el('input.input', { type: 'password', autocomplete: 'off' });
      var msg = el('div.lock-msg');
      var m;
      function done(v) { m.close(); resolve(v); }
      var ok = el('button.btn.primary', {
        type: 'button', text: 'باز کردن',
        onclick: function () {
          if (!input.value) { msg.textContent = 'رمز را وارد کنید.'; return; }
          done(input.value);
        }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
      });
      m = w.U.modal('نسخهٔ پشتیبان رمز دارد',
        el('div', null, [
          el('p', { text: 'فایل «' + fileName + '» رمزنگاری شده است. ' +
            'رمزی که هنگام ساختنش فعال بوده وارد کنید.' }),
          input, msg
        ]),
        [el('button.btn.ghost', { type: 'button', text: 'انصراف',
          onclick: function () { done(null); } }), ok]);
      setTimeout(function () { input.focus(); }, 50);
    });
  }

  w.UILock = {
    showLock: showLock, hide: hide, isShowing: isShowing,
    passwordDialog: passwordDialog, askBackupPassword: askBackupPassword,
    strength: strength
  };
})(window);
