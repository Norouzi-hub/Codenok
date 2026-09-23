/*
 * صفحهٔ شروع — وقتی هیچ دیتابیسی باز نیست.
 *
 * تا امروز برنامه با هر بار باز شدن در یک مرورگرِ تازه، ۳۱ پروندهٔ نمونه
 * می‌ساخت و بی‌رمز بالا می‌آمد. برای کسی که فایل را در مرورگر دیگری باز
 * می‌کرد، این یعنی «برنامه بدون هیچ احراز هویتی باز شد» — حتی اگر آنچه
 * می‌دید دادهٔ نمونه بود نه پروندهٔ واقعی.
 *
 * حالا برنامه بدون دیتابیس بالا نمی‌آید: اول می‌پرسد دیتابیس کجاست.
 * و چون رمز و نمکش داخل خودِ فایل دیتابیس‌اند، به‌محض باز شدنِ فایلِ
 * رمزدار، رمز پرسیده می‌شود — در هر مرورگر و هر رایانه‌ای.
 */
(function (w) {
  'use strict';

  var el = w.U.el;
  var overlay = null;

  function hide() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function isShowing() { return !!overlay; }

  /**
   * show(onReady) — صفحه را نشان می‌دهد و پس از آماده شدن دیتابیس،
   * onReady() را صدا می‌زند.
   */
  function show(onReady) {
    hide();
    var st = w.Store.status();
    var msg = el('div.start-msg');

    function fail(e) {
      if (e && e.name === 'AbortError') return;
      msg.textContent = e && e.message ? e.message : String(e);
      msg.className = 'start-msg bad';
    }

    function ready() {
      hide();
      onReady();
    }

    function option(icon, title, hint, onclick, primary) {
      return el('button.start-opt' + (primary ? '.primary' : ''), {
        type: 'button', onclick: onclick
      }, [
        el('span.start-opt-icon', { html: w.Mobile.icon(icon) }),
        el('span.start-opt-text', null, [
          el('b', { text: title }),
          el('span', { text: hint })
        ])
      ]);
    }

    var opts = el('div.start-opts');

    if (st.canLink) {
      opts.appendChild(option('db', 'باز کردن دیتابیس موجود',
        'فایلی که از قبل دارید. اگر رمز داشته باشد، رمزش پرسیده می‌شود.',
        function () {
          msg.textContent = 'در حال باز کردن…';
          msg.className = 'start-msg';
          w.Store.openFile().then(function (res) {
            w.U.toast(w.U.toFaDigits(res.cases) + ' پرونده از فایل خوانده شد.', 'good');
            ready();
          }).catch(fail);
        }, true));

      opts.appendChild(option('plus', 'ساخت دیتابیس تازه',
        'یک فایل خالی روی دیسک؛ از این پس همه‌چیز آنجا ذخیره می‌شود.',
        function () {
          msg.textContent = 'در حال ساخت…';
          msg.className = 'start-msg';
          w.Store.linkFile().then(function () { ready(); }).catch(fail);
        }));
    } else {
      opts.appendChild(el('div.start-note', null, [
        el('b', { text: 'این مرورگر نمی‌تواند روی فایل دیسک بنویسد. ' }),
        el('span', {
          text: 'ذخیرهٔ مستقیم روی فایل فقط در کروم و اج (روی رایانه) کار ' +
            'می‌کند. اینجا می‌توانید از نسخهٔ پشتیبان بازیابی کنید، ولی ' +
            'داده‌ها فقط در همین مرورگر می‌مانند.'
        })
      ]));
    }

    opts.appendChild(option('backup', 'بازیابی از نسخهٔ پشتیبان',
      'فایل JSON پشتیبان. در همهٔ مرورگرها کار می‌کند.',
      function () { restore(ready, fail); }));

    var body = el('div.start-box', null, [
      el('div.start-logo', { text: '🗂' }),
      el('h1', { text: 'دیتابیسی باز نیست' }),
      el('p.start-lead', {
        text: 'این برنامه داده‌هایش را در یک فایل روی دیسک شما نگه می‌دارد. ' +
          'بگویید آن فایل کجاست تا بالا بیاید.'
      }),
      opts,
      msg,
      el('p.start-foot', {
        text: 'اگر دیتابیس رمز داشته باشد، بدون رمز باز نمی‌شود — در هیچ ' +
          'مرورگری. رمز داخل خودِ فایل است، نه در این مرورگر.'
      })
    ]);

    /* راه گریز برای دادهٔ نمونه. عمداً کم‌رنگ و با برچسب صریح: کسی که
       می‌خواهد برنامه را ببیند لازمش دارد، ولی نباید مسیر پیش‌فرض باشد. */
    body.appendChild(el('button.linkish.start-demo', {
      type: 'button', text: 'ادامه با دادهٔ نمونه (بدون فایل، فقط برای آزمایش)',
      onclick: function () {
        w.Store.metaSet('demoMode', true).then(function () {
          ready();
        });
      }
    }));

    overlay = el('div.start-screen', null, [body]);
    document.body.appendChild(overlay);
    return overlay;
  }

  /** بازیابی از پشتیبان، بدون نیاز به اینکه برنامه بالا آمده باشد */
  function restore(ready, fail) {
    var input = el('input', { type: 'file', accept: '.json,application/json' });
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var file = (input.files || [])[0];
      input.remove();
      if (!file) return;
      file.text().then(function (text) {
        var payload = JSON.parse(text);
        if (!w.Vault.isSealed(payload)) return payload;
        return w.UILock.askBackupPassword(file.name).then(function (pw) {
          if (!pw) return null;
          return w.Vault.openAndAdopt(payload, pw).then(function (res) {
            return w.Store.metaSet('security', res.config).then(function () {
              return res.data;
            });
          });
        });
      }).then(function (snap) {
        if (!snap) return null;
        if (snap.app !== 'parvandeha') {
          throw new Error('این فایل، پشتیبان این برنامه نیست');
        }
        return w.Store.restore(snap).then(ready);
      }).catch(fail);
    });
    document.body.appendChild(input);
    input.click();
  }

  w.UIStart = { show: show, hide: hide, isShowing: isShowing };
})(window);
