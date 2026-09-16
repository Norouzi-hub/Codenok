/*
 * نمودارهای SVG درون‌خطی — بدون هیچ کتابخانهٔ بیرونی.
 * محورها راست‌به‌چپ‌اند: میله‌ها از خط پایهٔ سمت راست به چپ رشد می‌کنند و
 * محور زمان از راست (قدیمی‌تر) به چپ (تازه‌تر) می‌رود، مثل نمودارهای اکسل فارسی.
 *
 * پالت رنگ از references/palette.md گرفته و با scripts/validate_palette.js
 * روی سطح سفید کارت‌ها اعتبارسنجی شده است:
 *   categorical (۴ اسلات، مجاور)  → همهٔ بررسی‌ها PASS
 *   ordinal ۵ پله                  → همهٔ بررسی‌ها PASS
 * هشدار کنتراست اسلات‌های ۳ و ۴ با «برچسب مستقیم + نمای جدول» جبران شده است.
 */
(function (w) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var el = w.U.el;

  var C = {
    // هویت (کدام سری) — ترتیب ثابت، هرگز چرخشی
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
    // ترتیب (مرحلهٔ قیف، سطل سنی) — یک رنگ، روشن به تیره
    ordinal: ['#86b6ef', '#3987e5', '#256abf', '#184f95', '#0d366b'],
    // وضعیت — معنای رزرو‌شده، همیشه با آیکن و برچسب
    status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
    surface: '#ffffff',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    muted: '#898781',
    ink: '#0b0b0b',
    ink2: '#52514e'
  };

  /** زیرمجموعهٔ رمپ ترتیبی با حفظ دو سر بازه */
  function ordinalRamp(n) {
    var r = C.ordinal;
    if (n >= r.length) return r.slice(0, n);
    if (n === 1) return [r[2]];
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(r[Math.round(i * (r.length - 1) / (n - 1))]);
    }
    return out;
  }

  function svgEl(name, attrs) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] == null) return;
        node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  /*
   * در SVG راست‌به‌چپ معنای لنگر وارونه است: start لبهٔ *راست* متن را روی x
   * می‌گذارد (متن به چپ کشیده می‌شود) و end لبهٔ *چپ* را. با اسم‌های زیر
   * دیگر لازم نیست هر بار این را در ذهن برگردانیم.
   */
  var ANCHOR_RIGHT = 'start';   // متن از x شروع و به چپ کشیده می‌شود
  var ANCHOR_LEFT = 'end';      // متن از x شروع و به راست کشیده می‌شود

  function text(str, attrs) {
    var t = svgEl('text', attrs);
    t.appendChild(document.createTextNode(str));   // برچسب‌ها دادهٔ نامطمئن‌اند
    return t;
  }

  /** طول رندرشدهٔ متن؛ اگر عنصر هنوز به صفحه وصل نباشد null */
  function textWidth(node) {
    try {
      var len = node.getComputedTextLength();
      return len > 0 ? len : null;
    } catch (e) { return null; }
  }

  /**
   * متن را در صورت بیرون‌زدن از لبه‌های نمودار به داخل هل می‌دهد.
   * برچسب دو سرِ محور افقی وگرنه نصفه از کادر بیرون می‌ماند.
   */
  function clampText(node, svgWidth, pad) {
    pad = pad == null ? 2 : pad;
    var bb;
    try { bb = node.getBBox(); } catch (e) { return; }
    if (!bb || !bb.width) return;
    var x = parseFloat(node.getAttribute('x')) || 0;
    if (bb.x < pad) {
      node.setAttribute('x', x + (pad - bb.x));
    } else if (bb.x + bb.width > svgWidth - pad) {
      node.setAttribute('x', x - (bb.x + bb.width - (svgWidth - pad)));
    }
  }

  /** متن بلند را با «…» کوتاه می‌کند تا از جای تعیین‌شده بیرون نزند */
  function fitLabel(node, maxWidth) {
    var full = node.textContent;
    var len = textWidth(node);
    if (len == null || len <= maxWidth) return;
    var lo = 1, hi = full.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      node.textContent = full.slice(0, mid) + '…';
      if (node.getComputedTextLength() <= maxWidth) lo = mid; else hi = mid - 1;
    }
    node.textContent = full.slice(0, lo) + '…';
  }

  function fa(n) { return w.U.toFaDigits(n); }

  /** مسیر میله با سرِ گرد در انتهای داده و گوشهٔ تیز روی خط پایه */
  function barPath(x, y, width, height, r, round) {
    r = Math.min(r, height / 2, width);
    if (width <= 0.5) return '';
    if (round === 'left') {
      return 'M' + (x + width) + ',' + y +
        'H' + (x + r) + 'a' + r + ',' + r + ' 0 0 0 ' + (-r) + ',' + r +
        'V' + (y + height - r) + 'a' + r + ',' + r + ' 0 0 0 ' + r + ',' + r +
        'H' + (x + width) + 'Z';
    }
    // round === 'top' (ستونی)
    return 'M' + x + ',' + (y + height) +
      'V' + (y + r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + (-r) +
      'H' + (x + width - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r +
      'V' + (y + height) + 'Z';
  }

  // ------------------------------------------------------------------ تولتیپ
  var tip = null;
  function tooltip() {
    if (!tip) {
      tip = el('div.chart-tip');
      tip.setAttribute('role', 'status');
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTip(target, rows, title) {
    var box = tooltip();
    w.U.clear(box);
    if (title) box.appendChild(el('div.tip-title', { text: title }));
    rows.forEach(function (r) {
      box.appendChild(el('div.tip-row', null, [
        r.color ? el('span.tip-key', { style: 'background:' + r.color }) : null,
        el('b.tip-value', { text: r.value }),
        el('span.tip-label', { text: r.label })
      ]));
    });
    box.classList.add('show');
    var rect = target.getBoundingClientRect();
    var top = rect.top + window.scrollY - box.offsetHeight - 8;
    if (top < window.scrollY + 4) top = rect.bottom + window.scrollY + 8;
    var left = rect.left + rect.width / 2 - box.offsetWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - box.offsetWidth - 8));
    box.style.top = top + 'px';
    box.style.left = left + 'px';
  }

  function hideTip() { if (tip) tip.classList.remove('show'); }

  /** رویدادهای اشاره‌گر و صفحه‌کلید روی یک نشانه */
  function bindMark(node, rows, title, onActivate) {
    node.setAttribute('tabindex', '0');
    node.addEventListener('mouseenter', function () { showTip(node, rows, title); });
    node.addEventListener('focus', function () { showTip(node, rows, title); });
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('blur', hideTip);
    if (onActivate) {
      node.classList.add('clickable');
      node.addEventListener('click', onActivate);
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      });
    }
  }

  // ------------------------------------------------------- میلهٔ افقی (راست‌چین)
  /**
   * opts: { data:[{label,value,note?,key?}], color? , ramp? , onPick?, unit? }
   * یک سری = یک رنگ (اسلات ۱)؛ رستهٔ ترتیبی = رمپ تک‌رنگ.
   */
  function hbar(opts) {
    var data = opts.data || [];
    var rowH = 30, gap = 8, barH = Math.min(22, rowH - gap);
    var labelW = opts.labelWidth || 150;
    var valueW = opts.unit ? 70 : 54;
    var height = Math.max(1, data.length) * rowH + 8;
    var colors = opts.ramp ? ordinalRamp(data.length) : null;

    var svg = svgEl('svg', { class: 'chart', height: height, role: 'img' });
    svg.style.width = '100%';

    svg.draw = function (width) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var plotRight = width - labelW;          // خط پایه سمت راست
      var plotW = Math.max(10, plotRight - valueW);
      var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));

      data.forEach(function (d, i) {
        var y = i * rowH + 4;
        var len = Math.max(0, (d.value / max) * plotW);
        var x = plotRight - len;
        var color = colors ? colors[i] : (opts.color || C.series[0]);
        var valueText = fa(d.value) + (opts.unit ? ' ' + opts.unit : '');

        // برچسب رسته در سمت راست خط پایه، با توکن متن (نه رنگ داده)
        var label = text(d.label, {
          x: width - 6, y: y + barH / 2 + 4, 'text-anchor': ANCHOR_RIGHT,
          class: 'c-cat', fill: C.ink2
        });
        svg.appendChild(label);
        fitLabel(label, labelW - 14);

        var g = svgEl('g', { class: 'bar-g' });
        // ناحیهٔ اصابت بزرگ‌تر از خود نشانه
        g.appendChild(svgEl('rect', {
          x: 0, y: y - 3, width: Math.max(1, plotRight), height: barH + 6, fill: 'transparent'
        }));
        g.appendChild(svgEl('path', {
          d: barPath(x, y, len, barH, 4, 'left'), fill: color
        }));
        svg.appendChild(g);

        // مقدار در نوک میله؛ اگر بیرون جا نشد و داخل هم جا نشد، فقط در
        // تولتیپ و جدول می‌ماند — هرگز بریده نمی‌شود.
        var value = text(valueText, {
          x: x - 7, y: y + barH / 2 + 4, 'text-anchor': ANCHOR_RIGHT,
          class: 'c-val', fill: C.ink
        });
        svg.appendChild(value);
        var vw = textWidth(value);
        if (vw != null && x - 7 - vw < 2) {
          if (vw + 16 <= len) {
            value.setAttribute('x', x + 8);
            value.setAttribute('text-anchor', ANCHOR_LEFT);
            value.setAttribute('fill', '#ffffff');
          } else {
            svg.removeChild(value);
          }
        }

        bindMark(g, [{
          value: valueText, label: d.note || opts.valueLabel || 'پرونده', color: color
        }], d.label, opts.onPick && function () { opts.onPick(d); });
      });
      return svg;
    };
    return svg;
  }

  // ------------------------------------------------ نوار انباشتهٔ سهم از کل
  /** opts: { data:[{label,value}], onPick? } — حداکثر ۴ رسته، مابقی «سایر» */
  function stacked100(opts) {
    var data = opts.data || [];
    var total = data.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    var barH = 34, height = barH + 8;
    var svg = svgEl('svg', { class: 'chart', height: height, role: 'img' });
    svg.style.width = '100%';

    svg.draw = function (width) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var x = width;                       // از راست شروع می‌شود
      data.forEach(function (d, i) {
        var seg = (d.value / total) * width;
        var drawW = Math.max(0, seg - 2);  // فاصلهٔ ۲ پیکسلی به رنگ سطح
        var color = C.series[i % C.series.length];
        var g = svgEl('g');
        g.appendChild(svgEl('rect', {
          x: x - seg, y: 4, width: seg, height: barH, fill: 'transparent'
        }));
        g.appendChild(svgEl('rect', {
          x: x - seg, y: 4, width: drawW, height: barH, rx: 3, fill: color
        }));
        var pct = Math.round((d.value / total) * 100);
        var inner = fa(pct) + '٪';
        // برچسب فقط وقتی جا می‌شود داخل قطعه می‌آید
        if (drawW > inner.length * 9 + 16) {
          g.appendChild(text(inner, {
            x: x - seg / 2, y: 4 + barH / 2 + 5, 'text-anchor': 'middle',
            class: 'c-seg', fill: '#ffffff'
          }));
        }
        svg.appendChild(g);
        bindMark(g, [
          { value: fa(d.value) + ' پرونده', label: 'تعداد', color: color },
          { value: fa(pct) + '٪', label: 'سهم از کل' }
        ], d.label, opts.onPick && function () { opts.onPick(d); });
        x -= seg;
      });
      return svg;
    };
    return svg;
  }

  // --------------------------------------------------------- نمودار خطی زمانی
  /**
   * opts: { x:[برچسب‌ها ترتیب زمانی], series:[{name,values:[]}], unit? }
   * محور زمان از راست به چپ. یک محور y؛ هرگز دو مقیاس.
   */
  function lines(opts) {
    var xs = opts.x || [], series = opts.series || [];
    var height = opts.height || 220;
    var padTop = 14, padBottom = 30, padLeft = 16, padRight = 44;
    var svg = svgEl('svg', { class: 'chart', height: height, role: 'img' });
    svg.style.width = '100%';

    svg.draw = function (width) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var plotW = width - padLeft - padRight;
      var plotH = height - padTop - padBottom;
      var maxVal = 1;
      series.forEach(function (s) {
        s.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
      });
      var step = Math.max(1, Math.ceil(maxVal / 4));
      var top = step * 4;
      // x از راست به چپ
      var xAt = function (i) {
        return width - padRight - (xs.length === 1 ? plotW / 2 : (i * plotW) / (xs.length - 1));
      };
      var yAt = function (v) { return padTop + plotH - (v / top) * plotH; };

      // خطوط راهنما: مو‌خط یکدست، یک پله عقب‌تر از سطح
      for (var k = 0; k <= 4; k++) {
        var gy = yAt(step * k);
        svg.appendChild(svgEl('line', {
          x1: padLeft, y1: gy, x2: width - padRight, y2: gy,
          stroke: k === 0 ? C.axis : C.grid, 'stroke-width': 1
        }));
        svg.appendChild(text(fa(step * k), {
          x: width - padRight + 8, y: gy + 4, 'text-anchor': ANCHOR_LEFT,
          class: 'c-tick', fill: C.muted
        }));
      }

      // برچسب‌های محور x (تُنُک‌شده تا برخورد نکنند)
      var everyN = Math.max(1, Math.ceil(xs.length / Math.floor(plotW / 62)));
      xs.forEach(function (label, i) {
        if (i % everyN !== 0 && i !== xs.length - 1) return;
        var tick = text(label, {
          x: xAt(i), y: height - 10, 'text-anchor': 'middle',
          class: 'c-tick', fill: C.muted
        });
        svg.appendChild(tick);
        clampText(tick, width);
      });

      // وقتی نقطه‌های پایانی به هم نزدیک‌اند، برچسب مستقیم نمی‌گذاریم؛
      // جابه‌جا کردن عمودی برچسب آن را از خطش جدا می‌کند و نویز می‌شود.
      var lastIdx = xs.length - 1;
      var endYs = series.map(function (s) { return yAt(s.values[lastIdx] || 0); });
      var labelEnds = endYs.map(function (y, i) {
        return endYs.every(function (other, j) {
          return i === j || Math.abs(y - other) >= 16;
        });
      });

      series.forEach(function (s, si) {
        var color = C.series[si % C.series.length];
        var d = s.values.map(function (v, i) {
          return (i ? 'L' : 'M') + xAt(i) + ',' + yAt(v);
        }).join(' ');
        svg.appendChild(svgEl('path', {
          d: d, fill: 'none', stroke: color, 'stroke-width': 2,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        }));
        // نقطهٔ انتهایی با حلقهٔ ۲ پیکسلی به رنگ سطح
        if (lastIdx >= 0) {
          svg.appendChild(svgEl('circle', {
            cx: xAt(lastIdx), cy: endYs[si], r: 4.5,
            fill: color, stroke: C.surface, 'stroke-width': 2
          }));
          if (labelEnds[si]) {
            var endLabel = text(fa(s.values[lastIdx]), {
              x: xAt(lastIdx), y: endYs[si] - 10, 'text-anchor': 'middle',
              class: 'c-val', fill: C.ink
            });
            svg.appendChild(endLabel);
            clampText(endLabel, width);
          }
        }
      });

      // لایهٔ نشانگر: یک تولتیپ برای همهٔ سری‌ها در هر x
      var hair = svgEl('line', {
        y1: padTop, y2: padTop + plotH, stroke: C.axis,
        'stroke-width': 1, class: 'crosshair'
      });
      svg.appendChild(hair);

      xs.forEach(function (label, i) {
        var bandW = xs.length > 1 ? plotW / (xs.length - 1) : plotW;
        var hit = svgEl('rect', {
          x: xAt(i) - bandW / 2, y: padTop, width: bandW, height: plotH,
          fill: 'transparent', class: 'band-hit'
        });
        hit.addEventListener('mouseenter', function () {
          hair.setAttribute('x1', xAt(i));
          hair.setAttribute('x2', xAt(i));
          hair.classList.add('on');
        });
        hit.addEventListener('mouseleave', function () { hair.classList.remove('on'); });
        svg.appendChild(hit);
        bindMark(hit, series.map(function (s, si) {
          return {
            value: fa(s.values[i]) + (opts.unit ? ' ' + opts.unit : ''),
            label: s.name, color: C.series[si % C.series.length]
          };
        }), label);
      });
      return svg;
    };
    return svg;
  }

  // ------------------------------------------------------------------ راهنما
  /** راهنمای رنگ‌ها — برای دو سری یا بیشتر همیشه حاضر است */
  function legend(items, shape) {
    return el('div.c-legend', null, items.map(function (it, i) {
      return el('span.c-legend-item', null, [
        el('span.c-swatch' + (shape === 'line' ? '.line' : ''), {
          style: 'background:' + (it.color || C.series[i % C.series.length])
        }),
        el('span', { text: it.name }),
        it.value != null ? el('b.c-legend-val', { text: fa(it.value) }) : null
      ]);
    }));
  }

  /** همزاد جدولی هر نمودار — هر مقدار بدون نیاز به هاور در دسترس است */
  function table(headers, rows) {
    return el('table.c-table', null, [
      el('thead', null, [el('tr', null, headers.map(function (h) {
        return el('th', { text: h });
      }))]),
      el('tbody', null, rows.map(function (r) {
        return el('tr', null, r.map(function (c) { return el('td', { text: c }); }));
      }))
    ]);
  }

  // ------------------------------------------------- اندازه‌گیری و رسم واکنشی
  var mounted = [];

  /**
   * نمودار را در ظرف می‌گذارد و با عرض واقعی ظرف رسم می‌کند.
   * اگر ظرف هنوز به صفحه وصل نشده باشد عرضش صفر است؛ در آن حالت با عرض
   * موقت رسم می‌شود و settle() بعد از اتصال، رسم درست را انجام می‌دهد.
   */
  function mount(container, chart) {
    container.appendChild(chart);
    chart.draw(container.clientWidth || 600);
    mounted.push({ container: container, chart: chart });
    return chart;
  }

  function redrawAll() {
    mounted = mounted.filter(function (m) { return document.body.contains(m.chart); });
    mounted.forEach(function (m) {
      var width = m.container.clientWidth;
      if (width > 0) m.chart.draw(width);
    });
  }

  /** بعد از افزوده‌شدن نما به صفحه صدا زده می‌شود تا عرض‌ها واقعی شوند */
  function settle() {
    window.requestAnimationFrame(function () { redrawAll(); });
  }

  function reset() { mounted = []; hideTip(); }

  window.addEventListener('resize', w.U.debounce(redrawAll, 160));

  w.Charts = {
    C: C, hbar: hbar, stacked100: stacked100, lines: lines, legend: legend,
    table: table, mount: mount, reset: reset, redrawAll: redrawAll, settle: settle,
    ordinalRamp: ordinalRamp, hideTip: hideTip
  };
})(window);
