#!/usr/bin/env python3
"""
واژه‌نامهٔ غلط‌یاب فارسی — از Hunspellِ «لیلک» به یک فایل جاوااسکریپتِ فشرده.

    python3 tools/build_dict.py <index.aff> <index.dic>

ورودی همان بستهٔ dictionary-fa است (wooorm/dictionaries، از b00f/lilak،
مجوز Apache-2.0). خروجی src/assets/vendor/fa-dict.js است: واژه‌ها بر اساسِ
رشتهٔ پرچم‌هایشان دسته شده‌اند (۴۵ دسته به‌جای صد هزار پرچمِ تکراری)، و
قاعده‌های پسوند و پیشوند کنارشان. برنامه این فایل را بی‌شبکه می‌خواند؛ این
اسکریپت فقط وقتی لازم است که واژه‌نامه به‌روز شود.
"""
import json
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'vendor', 'fa-dict.js')

HEADER = '''/*
 * Lilak, Persian Spell Checking Dictionary — File Version 3.3, 2019-11-20
 * Copyright 2015 Mostafa Sedaghat Joo — https://github.com/b00f/lilak
 * Packaged by wooorm/dictionaries (dictionary-fa 2.0.0).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.
 *
 * تغییر: فقط شکلِ فایل — واژه‌ها بر اساسِ پرچم دسته شده‌اند و قاعده‌های
 * affix به JSON درآمده‌اند (tools/build_dict.py). محتوا همان است.
 */
'''


def parse_aff(path):
    sfx, pfx, rep, maps, flags = [], [], [], [], {}
    for line in open(path, encoding='utf-8'):
        parts = line.split()
        if not parts or parts[0].startswith('#'):
            continue
        tag = parts[0]
        if tag in ('SFX', 'PFX') and len(parts) >= 5:
            flag, strip, add = parts[1], parts[2], parts[3]
            cont = ''
            if '/' in add:
                add, cont = add.split('/', 1)
            if strip != '0':
                raise SystemExit('قاعدهٔ با strip پشتیبانی نمی‌شود: ' + line)
            if parts[4] != '.':
                raise SystemExit('قاعدهٔ شرط‌دار پشتیبانی نمی‌شود: ' + line)
            (sfx if tag == 'SFX' else pfx).append([flag, add, cont])
        elif tag == 'REP' and len(parts) == 3:
            rep.append([parts[1], parts[2]])
        elif tag == 'MAP' and len(parts) == 2:
            maps.append(parts[1])
        elif tag in ('NOSUGGEST', 'NEEDAFFIX', 'ONLYINCOMPOUND') and len(parts) == 2:
            flags[tag] = parts[1]
        elif tag == 'TRY' and len(parts) == 2:
            flags['TRY'] = parts[1]
    return sfx, pfx, rep, maps, flags


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    sfx, pfx, rep, maps, flags = parse_aff(sys.argv[1])
    groups = {}
    lines = open(sys.argv[2], encoding='utf-8').read().split('\n')
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        word, _, fl = line.partition('/')
        groups.setdefault(fl, []).append(word)
    data = {
        'sfx': sfx, 'pfx': pfx, 'rep': rep, 'map': maps,
        'try': flags.get('TRY', ''), 'nosuggest': flags.get('NOSUGGEST', ''),
        'needaffix': flags.get('NEEDAFFIX', ''), 'onlycompound': flags.get('ONLYINCOMPOUND', ''),
        'groups': {k: ' '.join(v) for k, v in groups.items()}
    }
    body = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(HEADER)
        f.write('window.FA_DICT = ' + body + ';\n')
    n = sum(len(v) for v in groups.values())
    print('%d واژه در %d دسته → %s (%.1f مگابایت)' % (
        n, len(groups), os.path.normpath(OUT), os.path.getsize(OUT) / 1048576))


if __name__ == '__main__':
    main()
