/*
 * نویسندهٔ docx — بدون هیچ کتابخانهٔ بیرونی.
 *
 * فایل docx یک بستهٔ ZIP است با چند XML داخلش؛ همان نویسندهٔ ZIP که برای
 * اکسل نوشته شده بود اینجا هم کار می‌کند. خروجی، فایل واقعی ورد است — نه
 * HTML با پسوند doc — پس ورد بازش می‌کند، ویرایش می‌شود و به هم نمی‌ریزد.
 *
 * نکتهٔ فارسی: راست‌به‌چپ بودن در ورد سه جا باید گفته شود و هر سه لازم است:
 *   ۱) پاراگراف:  <w:bidi/>
 *   ۲) متنِ داخل: <w:rtl/>
 *   ۳) جدول:      <w:bidiVisual/>   (وگرنه ستون‌ها آینه‌ای می‌شوند)
 * و اندازهٔ قلم فارسی جدا از لاتین است: w:sz برای لاتین، w:szCs برای فارسی.
 */
(function (w) {
  'use strict';

  var MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var utf8 = new TextEncoder();

  /** میلی‌متر به twip (۱/۱۴۴۰ اینچ) */
  function mm(v) { return Math.round((Number(v) || 0) * 56.6929); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /*
   * قلم فرم‌ها: «B Zar» — همان قلمی که نامه‌های اداری با آن تایپ می‌شوند.
   *
   * در ورد نمی‌شود فهرست قلمِ جایگزین داد (برخلاف CSS)؛ اگر B Zar روی آن
   * رایانه نصب نباشد، خودِ ورد قلم دیگری می‌گذارد. روی ویندوزِ اداری
   * معمولاً نصب است.
   *
   * اندازه: حرف‌های B Zar روی بدنهٔ قلم کوچک‌تر از تاهوما نشسته‌اند، پس
   * اندازهٔ یکسان روی کاغذ ریزتر دیده می‌شود. اندازهٔ متنِ فارسی
   * (szCs — که تقریباً همهٔ متنِ این فرم‌هاست) با همین ضریب جبران
   * می‌شود؛ اندازهٔ لاتین دست نمی‌خورد تا چیدمانِ تنظیم‌شدهٔ فرم‌ها
   * به‌هم نریزد.
   */
  var FONT = 'B Zar';
  var CS_SCALE = 1.18;
  // هر چهار جایگاهِ قلم: بی این، ورد رقم و نشانه را با Times New Roman می‌نویسد
  var FONTS = '<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:eastAsia="' + FONT +
    '" w:cs="' + FONT + '" w:hint="cs"/>';
  var LANG = '<w:lang w:val="fa-IR" w:eastAsia="fa-IR" w:bidi="fa-IR"/>';

  /** ویژگی‌های متن: درشتی، اندازه، و همیشه راست‌به‌چپ */
  function rPr(o) {
    o = o || {};
    var size = o.size || 22;            // نیم‌پوینت: ۲۲ یعنی ۱۱ پوینت
    var csSize = Math.round(size * CS_SCALE);
    return '<w:rPr>' + FONTS +
      (o.bold ? '<w:b/><w:bCs/>' : '') +
      '<w:sz w:val="' + size + '"/><w:szCs w:val="' + csSize + '"/>' +
      '<w:rtl/>' + LANG +
      '</w:rPr>';
  }

  /*
   * متن برای ورد و قلمِ B Zar:
   *   - «ٔ» (همزهٔ روی «ه») در B Zar نیست؛ ورد جایش دایرهٔ خالی می‌گذارد.
   *     نامه‌های دبیرخانه هم «نامه شماره» می‌نویسند، نه «نامهٔ شمارهٔ».
   *   - تاریخ و شمارهٔ نامه («۱۴۰۵/۰۷/۲۰») در متنِ راست‌به‌چپِ ورد وارونه
   *     می‌شود («۲۰/۰۷/۱۴۰۵»)؛ با نشانهٔ «چپ‌به‌راست» دورش، همان‌طور که
   *     نوشته شده می‌ماند.
   */
  function forWord(text) {
    return String(text == null ? '' : text)
      .replace(/\u0654/g, '').replace(/\u06C0/g, '\u0647')
      .replace(/[0-9\u06F0-\u06F9]+(?:[\/\-][0-9\u06F0-\u06F9]+)+/g, function (m) {
        return '\u202A' + m + '\u202C';
      });
  }

  function run(text, o) {
    return '<w:r>' + rPr(o) +
      '<w:t xml:space="preserve">' + esc(forWord(text)) + '</w:t></w:r>';
  }

  /*
   * ترازِ پاراگراف. در پاراگرافِ راست‌به‌چپِ ورد «right» و «left» جابه‌جا
   * خوانده می‌شوند — «right» چپ‌چین می‌شد. «start/end» همیشه درست است:
   * start = راست، end = چپ.
   */
  var JC = { right: 'start', left: 'end', center: 'center', both: 'both', start: 'start', end: 'end' };

  /** قابِ جاگذاری‌شده (برای نوارِ کنارِ سربرگ): میلی‌متر از لبهٔ کاغذ */
  function framePr(f) {
    return '<w:framePr w:w="' + mm(f.wMm) + '" w:hSpace="0" w:wrap="around"' +
      ' w:vAnchor="' + (f.anchor === 'text' ? 'text' : 'page') + '" w:hAnchor="page"' +
      ' w:x="' + mm(f.xMm) + '" w:y="' + mm(f.yMm || 0) + '"/>';
  }

  /**
   * پاراگراف. o: { bold, size, align: right|center|both, after, before,
   *                border, indent }
   *
   * ترتیب فرزندان pPr دلخواه نیست: طرح‌وارهٔ ECMA-376 یک «توالی» است و ورد
   * سخت‌گیر است — اگر jc قبل از spacing بیاید، فایل را «خراب» اعلام می‌کند.
   * ترتیب درست:  pBdr → bidi → spacing → ind → jc
   */
  function para(text, o) {
    o = o || {};
    var pPr = '<w:pPr>' +
      (o.keepNext ? '<w:keepNext/>' : '') +
      (o.frame ? framePr(o.frame) : '') +
      (o.border
        ? '<w:pBdr><w:right w:val="single" w:sz="12" w:space="6" w:color="000000"/></w:pBdr>'
        : '') +
      '<w:bidi/>' +
      '<w:spacing w:before="' + (o.before == null ? 0 : o.before) +
      '" w:after="' + (o.after == null ? 80 : o.after) +
      '" w:line="' + (o.line || 300) + '" w:lineRule="auto"/>' +
      (o.indent ? '<w:ind w:right="' + o.indent + '"/>' : '') +
      '<w:jc w:val="' + (JC[o.align] || 'start') + '"/>' +
      '<w:rPr>' + FONTS + '<w:rtl/></w:rPr>' +
      '</w:pPr>';
    var body = text == null || text === ''
      ? ''
      : String(text).split('\n').map(function (line, i) {
        return (i ? '<w:r><w:br/></w:r>' : '') + run(line, o);
      }).join('');
    return '<w:p>' + pPr + body + '</w:p>';
  }

  function emptyPara(o) { return para('', o); }

  /** یک خانهٔ جدول؛ متن‌ها آرایه‌ای از {text, bold} یا رشته */
  function cell(parts, o) {
    o = o || {};
    var runs = (Array.isArray(parts) ? parts : [parts]).map(function (p) {
      if (p == null) return '';
      if (typeof p === 'string') return run(p, { size: o.size });
      return String(p.text).split('\n').map(function (line, i) {
        return (i ? '<w:r><w:br/></w:r>' : '') + run(line, { bold: p.bold, size: p.size || o.size });
      }).join('');
    }).join('');
    // ترتیب tcPr:  tcW → gridSpan → vAlign
    return '<w:tc><w:tcPr>' +
      (o.width ? '<w:tcW w:w="' + o.width + '" w:type="dxa"/>' : '') +
      (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : '') +
      '<w:vAlign w:val="top"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:bidi/>' +
      '<w:spacing w:before="20" w:after="20" w:line="' + (o.line || 276) + '" w:lineRule="auto"/>' +
      '<w:jc w:val="' + (JC[o.align] || 'start') + '"/>' +
      '</w:pPr>' + runs + '</w:p>' +
      (o.minMm ? emptyHeight(o.minMm) : '') +
      '</w:tc>';
  }

  /** چند پاراگراف خالی، برای بازکردن ارتفاع خانه یا کادر */
  function emptyHeight(heightMm) {
    var lines = Math.max(1, Math.round(heightMm / 6));
    var out = '';
    for (var i = 0; i < lines; i++) out += '<w:p><w:pPr><w:bidi/><w:rPr>' + FONTS + '</w:rPr></w:pPr></w:p>';
    return out;
  }

  var BORDERS = '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) {
      return '<w:' + s + ' w:val="single" w:sz="6" w:space="0" w:color="000000"/>';
    }).join('') + '</w:tblBorders>';

  /** rows: آرایه‌ای از آرایهٔ خانه‌ها (خروجی cell) */
  function table(rows, cols, o) {
    o = o || {};
    var grid = '';
    // عرضِ مفیدِ صفحه (روی سربرگ باریک‌تر است)؛ پیش‌فرض: A4 با حاشیهٔ ۱۲ میلی‌متر
    var each = Math.round((o.total || 9638) / (cols || 1));
    for (var i = 0; i < (cols || 1); i++) {
      grid += '<w:gridCol w:w="' + (o.widths ? o.widths[i] : each) + '"/>';
    }
    // ترتیب tblPr:  bidiVisual → tblW → tblBorders → tblCellMar
    return '<w:tbl><w:tblPr>' +
      '<w:bidiVisual/>' +                      // بدون این، ستون‌ها چپ‌به‌راست می‌شوند
      '<w:tblW w:w="5000" w:type="pct"/>' +
      (o.noBorder ? '' : BORDERS) +
      '<w:tblCellMar>' +
      '<w:top w:w="40" w:type="dxa"/><w:start w:w="80" w:type="dxa"/>' +
      '<w:bottom w:w="40" w:type="dxa"/><w:end w:w="80" w:type="dxa"/>' +
      '</w:tblCellMar>' +
      '</w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' +
      rows.map(function (r) { return '<w:tr>' + r.join('') + '</w:tr>'; }).join('') +
      '</w:tbl>' + emptyPara({ after: 60 });    // ورد بعد از جدول یک پاراگراف می‌خواهد
  }

  // ------------------------------------------------------------ بستهٔ فایل
  function part(name, xml) {
    return { name: name, data: utf8.encode(xml) };
  }

  var CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="' + MIME + '.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  var ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Target="word/document.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>' +
    '</Relationships>';

  var DOC_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Target="styles.xml" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"/>' +
    '</Relationships>';

  var STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' + FONTS +
    '<w:sz w:val="22"/><w:szCs w:val="' + Math.round(22 * CS_SCALE) + '"/><w:rtl/>' + LANG +
    '</w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="start"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
    '<w:name w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:bidi/></w:pPr><w:rPr>' + FONTS + '<w:rtl/></w:rPr></w:style>' +
    '</w:styles>';

  /**
   * ساخت فایل.
   * body: رشتهٔ XML پاراگراف‌ها و جدول‌ها
   * opts: { topMm, bottomMm, sideMm, rightMm, leftMm } — حاشیه‌ها از لبهٔ کاغذ.
   *   sideMm هر دو پهلو را می‌دهد؛ rightMm/leftMm اگر بیایند، بر آن می‌چربند.
   *   در سربرگ، topMm و rightMm همان جایی است که چاپِ سازمان تمام می‌شود.
   */
  function build(body, opts) {
    opts = opts || {};
    var side = opts.sideMm == null ? 12 : opts.sideMm;
    var right = opts.rightMm == null ? side : opts.rightMm;
    var left = opts.leftMm == null ? side : opts.leftMm;
    var sect = '<w:sectPr>' +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="' + mm(opts.topMm == null ? 14 : opts.topMm) +
      '" w:right="' + mm(right) +
      '" w:bottom="' + mm(opts.bottomMm == null ? 14 : opts.bottomMm) +
      '" w:left="' + mm(left) +
      '" w:header="708" w:footer="708" w:gutter="0"/>' +
      '<w:bidi/>' +
      '</w:sectPr>';

    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body + sect + '</w:body></w:document>';

    return w.XLSX.zip([
      part('[Content_Types].xml', CONTENT_TYPES),
      part('_rels/.rels', ROOT_RELS),
      part('word/document.xml', doc),
      part('word/_rels/document.xml.rels', DOC_RELS),
      part('word/styles.xml', STYLES)
    ], MIME);
  }

  w.Docx = {
    build: build, para: para, emptyPara: emptyPara, run: run,
    cell: cell, table: table, emptyHeight: emptyHeight, mm: mm, esc: esc, MIME: MIME,
    forWord: forWord, FONT: FONT
  };
})(window);
