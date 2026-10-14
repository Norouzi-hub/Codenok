/*
 * نوشتن و خواندن فایل .xlsx بدون هیچ کتابخانهٔ بیرونی.
 * نوشتن: ZIP بدون فشرده‌سازی (store) + XML استاندارد SpreadsheetML.
 * خواندن: با DecompressionStream مرورگر (کروم/اج/فایرفاکس جدید).
 */
(function (w) {
  'use strict';

  // ------------------------------------------------------------------ CRC32
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  var utf8 = new TextEncoder();

  // -------------------------------------------------------------- ZIP writer
  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  /**
   * files: [{name, data: Uint8Array}] -> Blob
   * mime: نوع خروجی؛ پیش‌فرض xlsx، ولی همین نویسندهٔ ZIP برای docx هم به کار
   * می‌رود (هر دو بستهٔ OOXML‌اند).
   */
  function zip(files, mime) {
    var now = new Date(), time = dosTime(now), date = dosDate(now);
    var chunks = [], central = [], offset = 0;

    files.forEach(function (f) {
      var nameBytes = utf8.encode(f.name);
      var crc = crc32(f.data);
      var local = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);         // version needed
      dv.setUint16(6, 0x0800, true);     // پرچم UTF-8 برای نام فایل
      dv.setUint16(8, 0, true);          // روش: store
      dv.setUint16(10, time, true);
      dv.setUint16(12, date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, f.data.length, true);
      dv.setUint32(22, f.data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      chunks.push(local, f.data);

      var cd = new Uint8Array(46 + nameBytes.length);
      var cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);        // version made by
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0x0800, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, time, true);
      cdv.setUint16(14, date, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, f.data.length, true);
      cdv.setUint32(24, f.data.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + f.data.length;
    });

    var centralSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var end = new Uint8Array(22);
    var edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, centralSize, true);
    edv.setUint32(16, offset, true);

    return new Blob(chunks.concat(central, [end]), {
      type: mime ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  // ------------------------------------------------------------- XLSX writer
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colName(n) {                 // 0 -> A ، 26 -> AA
    var s = '';
    n += 1;
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = (n - 1 - r) / 26;
    }
    return s;
  }

  function sheetXml(sheet) {
    var rows = sheet.rows, out = [];
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
    out.push('<sheetViews><sheetView rightToLeft="1" workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>');
    out.push('<sheetFormatPr defaultRowHeight="18"/>');
    if (sheet.widths && sheet.widths.length) {
      out.push('<cols>' + sheet.widths.map(function (wd, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + wd +
          '" customWidth="1"/>';
      }).join('') + '</cols>');
    }
    out.push('<sheetData>');
    rows.forEach(function (row, ri) {
      var cells = [];
      for (var ci = 0; ci < row.length; ci++) {
        var v = row[ci];
        if (v == null || v === '') continue;
        cells.push('<c r="' + colName(ci) + (ri + 1) + '" s="' + (ri === 0 ? 1 : 0) +
          '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>');
      }
      out.push('<row r="' + (ri + 1) + '"' + (ri === 0 ? ' ht="30" customHeight="1"' : '') +
        '>' + cells.join('') + '</row>');
    });
    out.push('</sheetData>');
    if (rows.length > 1 && rows[0].length) {
      out.push('<autoFilter ref="A1:' + colName(rows[0].length - 1) + rows.length + '"/>');
    }
    out.push('</worksheet>');
    return out.join('');
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="10"/><name val="Tahoma"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/>' +
    '<bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
    '<alignment vertical="top" wrapText="1" readingOrder="2"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" ' +
    'applyFill="1" applyAlignment="1">' +
    '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  /** sheets: [{name, rows: [[...]], widths: [..]}] -> Blob (.xlsx) */
  function build(sheets) {
    var files = [];
    var ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
    var sheetRefs = [], wbRels = [];

    sheets.forEach(function (s, i) {
      var n = i + 1;
      ct.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType=' +
        '"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      sheetRefs.push('<sheet name="' + esc(s.name) + '" sheetId="' + n + '" r:id="rId' + n + '"/>');
      wbRels.push('<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/' +
        'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>');
      files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: utf8.encode(sheetXml(s)) });
    });
    ct.push('</Types>');

    wbRels.push('<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.' +
      'openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');

    files.unshift(
      { name: '[Content_Types].xml', data: utf8.encode(ct.join('')) },
      {
        name: '_rels/.rels', data: utf8.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/' +
          'relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
      },
      {
        name: 'xl/workbook.xml', data: utf8.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets>' + sheetRefs.join('') + '</sheets></workbook>')
      },
      {
        name: 'xl/_rels/workbook.xml.rels', data: utf8.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          wbRels.join('') + '</Relationships>')
      },
      { name: 'xl/styles.xml', data: utf8.encode(STYLES) }
    );

    return zip(files);
  }

  // ------------------------------------------------------------- XLSX reader
  function inflateRaw(bytes) {
    if (typeof w.DecompressionStream !== 'function') {
      return Promise.reject(new Error('این مرورگر از بازکردن فایل فشرده پشتیبانی نمی‌کند'));
    }
    var ds = new w.DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /** ورودی: ArrayBuffer فایل xlsx -> Promise<{name: Uint8Array}> */
  function unzip(buffer) {
    var bytes = new Uint8Array(buffer), dv = new DataView(buffer);
    // یافتن End Of Central Directory از انتهای فایل
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('فایل zip معتبر نیست'));
    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);
    var decoder = new TextDecoder('utf-8');
    var entries = [], p = cdOffset;

    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOffset = dv.getUint32(p + 42, true);
      var name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name: name, method: method, compSize: compSize, localOffset: localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }

    var out = {};
    return entries.reduce(function (chain, e) {
      return chain.then(function () {
        var lnameLen = dv.getUint16(e.localOffset + 26, true);
        var lextraLen = dv.getUint16(e.localOffset + 28, true);
        var start = e.localOffset + 30 + lnameLen + lextraLen;
        var raw = bytes.subarray(start, start + e.compSize);
        if (e.method === 0) { out[e.name] = raw; return; }
        if (e.method !== 8) return;      // روش‌های نادر را نادیده می‌گیریم
        return inflateRaw(raw).then(function (d) { out[e.name] = d; });
      });
    }, Promise.resolve()).then(function () { return out; });
  }

  /** ورودی: ArrayBuffer -> Promise<[[cell,...],...]> از اولین شیت */
  function read(buffer) {
    return unzip(buffer).then(function (files) {
      var dec = new TextDecoder('utf-8');
      var parser = new DOMParser();

      var shared = [];
      if (files['xl/sharedStrings.xml']) {
        var sdoc = parser.parseFromString(dec.decode(files['xl/sharedStrings.xml']), 'application/xml');
        Array.prototype.forEach.call(sdoc.getElementsByTagName('si'), function (si) {
          var ts = si.getElementsByTagName('t'), txt = '';
          for (var i = 0; i < ts.length; i++) {
            if (ts[i].parentNode.nodeName === 'rPh') continue;
            txt += ts[i].textContent;
          }
          shared.push(txt);
        });
      }

      var sheetName = Object.keys(files).filter(function (k) {
        return /^xl\/worksheets\/sheet\d+\.xml$/.test(k);
      }).sort()[0];
      if (!sheetName) throw new Error('شیتی در فایل پیدا نشد');

      var doc = parser.parseFromString(dec.decode(files[sheetName]), 'application/xml');
      var rows = [];
      Array.prototype.forEach.call(doc.getElementsByTagName('row'), function (r) {
        var cells = [];
        Array.prototype.forEach.call(r.getElementsByTagName('c'), function (c) {
          var ref = c.getAttribute('r') || '';
          var letters = ref.replace(/\d+/g, '');
          var idx = 0;
          for (var i = 0; i < letters.length; i++) {
            idx = idx * 26 + (letters.charCodeAt(i) - 64);
          }
          idx = idx - 1;
          var type = c.getAttribute('t');
          var value = '';
          if (type === 'inlineStr') {
            var is = c.getElementsByTagName('t');
            for (var k = 0; k < is.length; k++) value += is[k].textContent;
          } else {
            var vEl = c.getElementsByTagName('v')[0];
            value = vEl ? vEl.textContent : '';
            if (type === 's') value = shared[+value] || '';
          }
          while (cells.length < idx) cells.push('');
          cells[idx] = value;
        });
        rows.push(cells);
      });
      return rows;
    });
  }

  w.XLSX = { build: build, read: read, zip: zip, colName: colName };
})(window);
