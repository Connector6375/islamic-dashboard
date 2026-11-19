#!/usr/bin/env python3
"""Kuwait MOE e-library (المكتبة الالكترونية, https://elibrary.moe.edu.kw) helper.

Finds the student textbook, teacher guide and semester (curriculum distribution) plan for a
type / stage / grade / subject / term, classifies what the library returns, downloads the PDFs and
writes a manifest the agent can use to upload them to Google Drive.

Standard library only, so it runs anywhere Python 3.8+ runs (Claude Code, claude.ai code sandbox, Cowork).
It honours HTTPS_PROXY / SSL_CERT_FILE and never disables TLS verification.

Commands
  check                       connectivity test (prints the fix when the host is blocked)
  lookups [--type T] [--stage S] [--grade G]
                              list the library's option names/ids, one level deeper per flag
  find   --stage S --grade G --subject X [--type T] [--term 1|2|all] [--all] [--json]
                              classify everything the library has for that selection
  fetch  --stage S --grade G --subject X [--type T] [--term 1|2|all] [--kinds ...] --out DIR
                              find + download the newest file of each kind, write DIR/manifest.json
  download --id N --out DIR [--name FILE]
                              download one file by its bookFileID

Names may be Arabic (diacritics optional) or numeric ids. Defaults: --type التعليم العام, --term all.
"""
import argparse
import hashlib
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date

BASE = 'https://elibrary.moe.edu.kw'
UA = 'Mozilla/5.0 (compatible; elibrary-books-skill/1.0)'
DEFAULT_TYPE = 'التعليم العام'
MOE_YEAR = 2023          # the site's own search form sends this constant; override with --moe-year
HOST = 'elibrary.moe.edu.kw'

KIND_EN = {
    'student_textbook': 'Student Textbook',
    'teacher_guide': 'Teacher Guide',
    'semester_plan': 'Semester Plan',
    'student_workbook': 'Student Workbook',
    'exam': 'Exam',
    'other': 'Other',
}
SELECTABLE = ('student_textbook', 'teacher_guide', 'semester_plan')


# ----------------------------------------------------------------------------- http
def _ctx():
    for var in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE'):
        p = os.environ.get(var)
        if p and os.path.exists(p):
            return ssl.create_default_context(cafile=p)
    if os.path.exists('/root/.ccr/ca-bundle.crt'):          # Claude Code on the web
        return ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
    return ssl.create_default_context()


def _blocked_hint(err):
    return (
        f'\nCould not reach {HOST}: {err}\n'
        'If this is a 403 from a proxy, the sandbox network policy does not allow the host. Allow '
        f'"{HOST}" in the environment\'s network settings (Claude Code on the web: the environment\'s allowed '
        'hosts; claude.ai chat/Cowork: the code-execution network/egress allowlist), then retry.\n')


def http(path, data=None, retries=3, stream_to=None):
    url = path if path.startswith('http') else BASE + path
    headers = {'User-Agent': UA, 'Accept': 'application/json, application/pdf, */*'}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=120, context=_ctx()) as r:
                if stream_to:
                    h = hashlib.sha256()
                    size = 0
                    with open(stream_to, 'wb') as f:
                        while True:
                            chunk = r.read(1 << 20)
                            if not chunk:
                                break
                            f.write(chunk)
                            h.update(chunk)
                            size += len(chunk)
                    return {'sha256': h.hexdigest(), 'size': size, 'type': r.headers.get('Content-Type', '')}
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (401, 403, 407):          # proxy / auth refusals do not get better by retrying
                break
        except Exception as e:                      # network hiccup
            last = e
        time.sleep(1.5 * (i + 1))
    sys.exit(_blocked_hint(last))


def jget(path):
    return json.loads(http(path).decode('utf-8'))


# ----------------------------------------------------------------------------- names
_TASHKEEL = re.compile('[ً-ٰٟـ]')


def norm(s):
    s = _TASHKEEL.sub('', str(s or ''))
    s = (s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه'))
    return re.sub(r'\s+', ' ', s).strip().lower()


def resolve(options, wanted, what):
    """options: [{value, text}]; wanted: id (digits) or a name. Returns the matching option."""
    if wanted is None:
        sys.exit(f'--{what} is required')
    if str(wanted).isdigit():
        for o in options:
            if o['value'] == int(wanted):
                return o
        sys.exit(f'No {what} with id {wanted}')
    w = norm(wanted)
    exact = [o for o in options if norm(o['text']) == w]
    part = [o for o in options if w in norm(o['text'])]
    hit = exact or part
    if len(hit) == 1:
        return hit[0]
    names = ', '.join(f"{o['text'].strip()} ({o['value']})" for o in options)
    sys.exit(f'Could not pick a {what} for "{wanted}" ({len(hit)} matches). Options: {names}')


def lk(path):
    return jget('/api/LibraryLookups/' + path)['data']


def resolve_selection(a):
    t = resolve(lk('EducationTypes'), a.type or DEFAULT_TYPE, 'type')
    s = resolve(lk(f"EducationStages/{t['value']}"), a.stage, 'stage')
    g = resolve(lk(f"EducationGrades/{s['value']}"), a.grade, 'grade')
    x = resolve(lk(f"EducationSubjects/{g['value']}"), a.subject, 'subject')
    return t, s, g, x


# ----------------------------------------------------------------------------- classify
def years_of(title):
    """Academic year in a title. The library writes some RTL years reversed ('2026/2025' = 2025/2026)."""
    m = re.search(r'(20\d\d)\s*[/\-–—]\s*(20\d\d)', title or '')
    if not m:
        return None
    a, b = sorted((int(m.group(1)), int(m.group(2))))
    return (a, b)


def classify(item, books_for):
    d = item.get('fileDescription') or ''
    n = norm(d)
    special = any(k in n for k in ('بطء', 'بطي', 'فصول خاصه', 'صعوبات', 'تربيه خاصه'))
    if 'توزيع المنهج' in n or norm('توزيع المنهج') in n:
        kind = 'semester_plan'
    elif 'دليل المعلم' in n:
        kind = 'teacher_guide'
    elif books_for == 1 and ('نشاط' in n or 'كراس' in n):
        kind = 'student_workbook'
    elif books_for == 1:
        kind = 'student_textbook'
    else:
        kind = 'other'
    y = years_of(d)
    return {
        'id': item['bookFileID'],
        'kind': kind,
        'kind_en': KIND_EN[kind],
        'title': d.strip(),
        'term': item.get('term'),
        'year': f'{y[0]}-{str(y[1])[2:]}' if y else None,
        'year_end': y[1] if y else None,
        'special_class': special,
        'uploaded': (item.get('createdDate') or '')[:10],
        'downloads': item.get('downloadCount'),
        'books_for': 'student' if books_for == 1 else 'teacher',
    }


def current_academic_end():
    t = date.today()
    return t.year + 1 if t.month >= 9 else t.year


def search(sel, term, books_for, moe_year):
    t, s, g, x = sel
    payload = {'BooksFor': books_for, 'MoeYear': moe_year, 'EducationTypeID': t['value'],
               'EducationStageID': s['value'], 'EducationGradeID': g['value'],
               'EducationSubjectID': x['value'], 'Term': term}
    raw = http('/api/librarysearch', data=payload)
    return json.loads(raw.decode('utf-8'))


def find_all(a):
    sel = resolve_selection(a)
    terms = [1, 2] if str(a.term) == 'all' else [int(a.term)]
    out = []
    for term in terms:
        for books_for in (1, 2):                    # 1 = student library, 2 = teacher library
            res = search(sel, term, books_for, a.moe_year)
            for it in res.get('books', []):
                c = classify(it, books_for)
                c['term'] = term
                out.append(c)
            if a.kinds_include_exams:
                for it in res.get('examFiles', []) or []:
                    c = classify(it, books_for)
                    c['kind'], c['kind_en'], c['term'] = 'exam', KIND_EN['exam'], term
                    out.append(c)
    return sel, out


def pick(items, kinds, include_special):
    """Newest upload of each wanted kind, per term (special-class variants only when asked)."""
    chosen = []
    for term in sorted({i['term'] for i in items}):
        for kind in kinds:
            pool = [i for i in items if i['term'] == term and i['kind'] == kind
                    and (include_special or not i['special_class'])]
            if pool:
                best = sorted(pool, key=lambda i: (i['uploaded'], i['id']), reverse=True)[0]
                chosen.append(best)
    return chosen


def stale_note(i):
    end = current_academic_end()
    if i['year_end'] and i['year_end'] < end:
        return f"dated {i['year']} but the current academic year ends {end}: a newer one may not be uploaded yet"
    return None


def suggest_title(i, sel):
    t, s, g, x = sel
    tag = i['year'] or ('uploaded ' + i['uploaded'][:7])
    subject = x['text'].strip()
    grade = g['text'].strip()
    extra = ' (special classes)' if i['special_class'] else ''
    return f"{i['kind_en']} - {subject} - {grade} - T{i['term']} - {tag}{extra}.pdf"


# ----------------------------------------------------------------------------- commands
def cmd_check(a):
    types = lk('EducationTypes')
    print('OK: reached', BASE, '-', ', '.join(t['text'].strip() for t in types))


def cmd_lookups(a):
    if not a.type:
        rows = lk('EducationTypes')
    else:
        t = resolve(lk('EducationTypes'), a.type, 'type')
        if not a.stage:
            rows = lk(f"EducationStages/{t['value']}")
        else:
            s = resolve(lk(f"EducationStages/{t['value']}"), a.stage, 'stage')
            if not a.grade:
                rows = lk(f"EducationGrades/{s['value']}")
            else:
                g = resolve(lk(f"EducationGrades/{s['value']}"), a.grade, 'grade')
                rows = lk(f"EducationSubjects/{g['value']}")
    for r in rows:
        print(f"{r['value']}\t{r['text'].strip()}")


def show(items, sel, as_json):
    rows = []
    for i in items:
        r = dict(i)
        r['drive_title'] = suggest_title(i, sel)
        note = stale_note(i)
        if note:
            r['note'] = note
        rows.append(r)
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return
    for r in sorted(rows, key=lambda r: (r['term'], r['kind'], r['uploaded']), reverse=False):
        flag = ' [special-class variant]' if r['special_class'] else ''
        print(f"T{r['term']} {r['kind']:<17} id={r['id']:<5} up={r['uploaded']} year={r['year'] or '-'}{flag}\n      {r['title']}")


def cmd_find(a):
    sel, items = find_all(a)
    print('# selection:', ' > '.join(x['text'].strip() for x in sel), file=sys.stderr)
    if not a.all:
        items = [i for i in items if i['kind'] in SELECTABLE + ('student_workbook',)]
    show(items, sel, a.json)


def download(book_id, out_dir, name=None):
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, f'.{book_id}.part')
    info = http(f'/api/File/preview/book/{book_id}', stream_to=tmp)
    with open(tmp, 'rb') as f:
        magic = f.read(5)
    if magic != b'%PDF-':
        os.remove(tmp)
        sys.exit(f'Download {book_id} is not a PDF (got {info["type"]!r}); the library may need a login for it.')
    path = os.path.join(out_dir, name or f'elibrary-{book_id}.pdf')
    os.replace(tmp, path)
    info['path'] = os.path.abspath(path)
    return info


def cmd_download(a):
    info = download(a.id, a.out, a.name)
    print(json.dumps(info, ensure_ascii=False, indent=2))


def cmd_fetch(a):
    sel, items = find_all(a)
    kinds = [k.strip() for k in a.kinds.split(',') if k.strip()]
    bad = [k for k in kinds if k not in KIND_EN]
    if bad:
        sys.exit('Unknown kind(s): ' + ', '.join(bad) + '. Kinds: ' + ', '.join(KIND_EN))
    chosen = pick(items, kinds, a.include_special)
    if not chosen:
        sys.exit('Nothing found for that selection (try `find --all` to see what the library has).')
    manifest = []
    for i in chosen:
        title = suggest_title(i, sel)
        safe = re.sub(r'[\\/:*?"<>|]', '-', title)
        info = download(i['id'], a.out, safe)
        row = {**i, 'drive_title': title, 'file': info['path'], 'size': info['size'], 'sha256': info['sha256'],
               'drive_upload_ref': f"sha256:{info['sha256']}:{info['path']}"}
        note = stale_note(i)
        if note:
            row['note'] = note
        manifest.append(row)
        print(f"saved {row['kind']} T{i['term']} -> {info['path']} ({info['size']:,} bytes)", file=sys.stderr)
    mp = os.path.join(a.out, 'manifest.json')
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump({'selection': [x['text'].strip() for x in sel], 'files': manifest}, f, ensure_ascii=False, indent=2)
    print(mp)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)

    def sel_args(sp):
        sp.add_argument('--type', help=f'education type (default {DEFAULT_TYPE})')
        sp.add_argument('--stage', help='stage, e.g. الابتدائية')
        sp.add_argument('--grade', help='grade, e.g. الخامس')
        sp.add_argument('--subject', help='subject, e.g. التربية الإسلامية')
        sp.add_argument('--term', default='all', help='1, 2 or all (default all)')
        sp.add_argument('--moe-year', type=int, default=MOE_YEAR, help=argparse.SUPPRESS)
        sp.set_defaults(kinds_include_exams=False)

    sub.add_parser('check').set_defaults(fn=cmd_check)
    sp = sub.add_parser('lookups')
    sp.add_argument('--type')
    sp.add_argument('--stage')
    sp.add_argument('--grade')
    sp.set_defaults(fn=cmd_lookups)
    sp = sub.add_parser('find')
    sel_args(sp)
    sp.add_argument('--all', action='store_true', help='also show other kinds (exams, unclassified)')
    sp.add_argument('--json', action='store_true')
    sp.set_defaults(fn=cmd_find)
    sp = sub.add_parser('fetch')
    sel_args(sp)
    sp.add_argument('--kinds', default=','.join(SELECTABLE), help='comma list of: ' + ', '.join(KIND_EN))
    sp.add_argument('--include-special', action='store_true', help='allow slow-learner / special-class variants')
    sp.add_argument('--out', required=True)
    sp.set_defaults(fn=cmd_fetch)
    sp = sub.add_parser('download')
    sp.add_argument('--id', type=int, required=True)
    sp.add_argument('--out', required=True)
    sp.add_argument('--name')
    sp.set_defaults(fn=cmd_download)

    a = p.parse_args()
    if a.cmd in ('find', 'fetch') and not (a.stage and a.grade and a.subject):
        p.error('find/fetch need --stage, --grade and --subject')
    a.fn(a)


if __name__ == '__main__':
    main()
