# -*- coding: utf-8 -*-
"""ساخت نسخهٔ تک‌فایلی برنامه در dist/parvandeha.html"""
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')

BANNER = """<!--
  سامانهٔ مدیریت پرونده‌های کمیتهٔ انضباطی
  ساخته‌شده به‌صورت یک فایل مستقل: بدون نصب، بدون سرور، بدون اینترنت.
  کافی است این فایل را در کروم، اج یا فایرفاکس باز کنید.
  منبع کد: پوشهٔ src/ — ساخت دوباره: python3 tools/build.py
-->
"""


def read(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def main():
    html = read(os.path.join(SRC, 'index.html'))

    # حذف بخش مخصوص حالت توسعه
    html = re.sub(r'<!-- DEV-ONLY:.*?<!-- /DEV-ONLY -->', '', html, flags=re.S)

    # درج CSS
    css = read(os.path.join(SRC, 'css', 'app.css'))
    html = html.replace('<link rel="stylesheet" href="css/app.css">',
                        '<style>\n' + css + '\n</style>')

    # درج باینری SQLite
    wasm_b64 = read(os.path.join(SRC, 'vendor', 'sql-wasm.wasm.b64')).strip()
    html = html.replace('<script id="sqljs-wasm" type="text/plain"></script>',
                        '<script id="sqljs-wasm" type="text/plain">' + wasm_b64 + '</script>')

    # درج اسکریپت‌ها به همان ترتیب
    def inline(match):
        src = match.group(1)
        code = read(os.path.join(SRC, *src.split('/')))
        if '</script' in code:
            raise SystemExit('فایل %s شامل تگ بستهٔ script است' % src)
        return '<script>\n/* ==== ' + src + ' ==== */\n' + code + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

    if not os.path.isdir(DIST):
        os.makedirs(DIST)
    out = os.path.join(DIST, 'parvandeha.html')
    with io.open(out, 'w', encoding='utf-8') as fh:
        fh.write(BANNER + html)

    size = os.path.getsize(out)
    remaining = re.findall(r'(?:src|href)="(?!data:)([^"]+)"', html)
    print('ساخته شد: %s (%.1f مگابایت)' % (out, size / 1048576.0))
    if remaining:
        print('هشدار — ارجاع بیرونی باقی مانده:', remaining)
    else:
        print('هیچ ارجاع بیرونی باقی نمانده — فایل کاملاً مستقل است.')


if __name__ == '__main__':
    main()
