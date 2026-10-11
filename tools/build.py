# -*- coding: utf-8 -*-
"""
ساخت نسخهٔ قابل‌تحویلِ نوکمان از روی src/

سه خروجی، از یک منبع:

  dist/nokman/        پروژهٔ استاندارد: index.html و پوشهٔ assets کنارش
                      (css، js، fonts، vendor، img) — همان ساختار src/
  dist/nokman.zip     همان پوشه، فشرده، برای تحویل
  dist/nokman.html    نسخهٔ تک‌فایلی: همه‌چیز درون یک فایل، برای وقتی که
                      فقط یک فایل می‌شود جابه‌جا کرد

هیچ‌کدام سرور یا اینترنت نمی‌خواهد؛ index.html را در کروم یا اج باز کنید.
"""
import base64
import io
import os
import re
import shutil
import urllib.parse
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
NAME = 'nokman'

GUIDE = """نوکمان — سامانهٔ پرونده‌های کمیتهٔ انضباطی
================================================

اجرا
----
۱) این زیپ را کامل باز کنید (راست‌کلیک ← Extract All).
   از داخلِ خودِ زیپ اجرا نکنید؛ آن‌وقت پوشهٔ assets پیدا نمی‌شود.
۲) فایل index.html را در کروم یا اج باز کنید.

پوشهٔ assets باید همیشه کنار index.html بماند.

ساختار
------
index.html          صفحهٔ برنامه (فقط ساختار؛ بدون اسکریپت و استایلِ درون‌خطی)
assets/css/         استایل‌ها (app.css، fonts.css)
assets/js/          اسکریپت‌های برنامه
assets/fonts/       قلم وزیرمتن
assets/vendor/      موتور SQLite (sql.js)
assets/img/         نماد برنامه

داده‌ها
-------
داده‌ها در این پوشه نیستند: در حافظهٔ مرورگر و (اگر وصل کرده باشید) در
فایل دیتابیس روی دیسک‌اند. جایگزین کردنِ این پوشه با نسخهٔ تازه داده‌ای
را پاک نمی‌کند. پیش از به‌روزرسانی، از «تنظیمات» نسخهٔ پشتیبان بگیرید.
"""

BANNER = """<!--
  نوکمان — سامانهٔ پرونده‌های کمیتهٔ انضباطی
  نسخهٔ تک‌فایلی: بدون نصب، بدون سرور، بدون اینترنت.
  منبع کد: پوشهٔ src/ — ساخت دوباره: python3 tools/build.py
-->
"""

SKIP = {'.DS_Store', 'Thumbs.db'}


def read(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def src_path(rel):
    return os.path.join(SRC, *rel.split('/'))


def refs(html):
    """همهٔ نشانی‌های محلیِ صفحه — باید همه وجود داشته باشند"""
    return [r for r in re.findall(r'(?:src|href)="([^"]+)"', html)
            if not r.startswith(('data:', 'http:', 'https:', '#'))]


def build_folder():
    out = os.path.join(DIST, NAME)
    if os.path.isdir(out):
        shutil.rmtree(out)
    shutil.copytree(SRC, out, ignore=shutil.ignore_patterns(*SKIP))
    with io.open(os.path.join(out, 'README.txt'), 'w', encoding='utf-8-sig',
                 newline='\r\n') as fh:
        fh.write(GUIDE)
    return out


def build_zip(folder):
    path = os.path.join(DIST, NAME + '.zip')
    if os.path.exists(path):
        os.remove(path)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(folder):
            dirs.sort()
            for f in sorted(files):
                full = os.path.join(base, f)
                rel = os.path.relpath(full, DIST).replace(os.sep, '/')
                z.write(full, rel)
    return path


def build_single():
    html = read(os.path.join(SRC, 'index.html'))

    font = base64.b64encode(open(src_path('assets/fonts/vazirmatn.woff2'), 'rb').read())
    font_uri = 'data:font/woff2;base64,' + font.decode('ascii')

    def style(match):
        rel = match.group(1)
        css = read(src_path(rel))
        css = css.replace('url("../fonts/vazirmatn.woff2")', 'url(' + font_uri + ')')
        if 'url("../' in css:
            raise SystemExit('نشانی نسبیِ جاسازی‌نشده در %s' % rel)
        return '<style>\n/* ==== ' + rel + ' ==== */\n' + css + '\n</style>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', style, html)

    icon = read(src_path('assets/img/icon.svg')).strip()
    html = html.replace('href="assets/img/icon.svg"',
                        'href="data:image/svg+xml,' + urllib.parse.quote(icon) + '"')

    def inline(match):
        rel = match.group(1)
        code = read(src_path(rel))
        if '</script' in code:
            raise SystemExit('فایل %s شامل تگ بستهٔ script است' % rel)
        return '<script>\n/* ==== ' + rel + ' ==== */\n' + code + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

    left = refs(html)
    if left:
        raise SystemExit('ارجاع بیرونی در نسخهٔ تک‌فایلی مانده: %s' % left)
    path = os.path.join(DIST, NAME + '.html')
    with io.open(path, 'w', encoding='utf-8') as fh:
        fh.write(BANNER + html)
    return path


def main():
    page = read(os.path.join(SRC, 'index.html'))
    if re.search(r'<script>(?!\s*</script>)|<style>', page):
        raise SystemExit('index.html اسکریپت یا استایلِ درون‌خطی دارد؛ جایش assets است')
    gone = [r for r in refs(page) if not os.path.exists(src_path(r))]
    if gone:
        raise SystemExit('فایل‌های گم‌شده: %s' % gone)

    if not os.path.isdir(DIST):
        os.makedirs(DIST)
    folder = build_folder()
    zpath = build_zip(folder)
    single = build_single()

    mb = lambda p: os.path.getsize(p) / 1048576.0
    n = sum(len(f) for _, _, f in os.walk(folder))
    print('پوشه:     %s (%d فایل)' % (folder, n))
    print('زیپ:      %s (%.1f مگابایت)' % (zpath, mb(zpath)))
    print('تک‌فایلی: %s (%.1f مگابایت)' % (single, mb(single)))


if __name__ == '__main__':
    main()
