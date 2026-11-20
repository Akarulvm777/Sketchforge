"""Read CHANGELOG.md: sections "## <version>: <title>" followed by "- " items.

Used by build.py (What's new and the update history inside the app), tools/release_notes.py (GitHub release notes)
and tools/tests/test_release.py.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'CHANGELOG.md')
_HEAD = re.compile(r'## (\d+\.\d+(?:\.\d+)?):\s*(.*)')


def vkey(v):
    return [int(x) for x in v.split('.')]


def minor(version):
    """'2.13.4' -> '2.13' (changelog sections are written per minor version)."""
    return '.'.join(version.split('.')[:2])


def parse(text):
    """-> [{'v', 'title', 'items'}] in file order."""
    out = []
    for sec in re.split(r'\n(?=## )', text):
        m = _HEAD.match(sec)
        if not m:
            continue
        lines = sec.split('\n')
        out.append({'v': m.group(1), 'title': m.group(2).strip(),
                    'items': [l[2:].replace('**', '').strip() for l in lines[1:] if l.startswith('- ')]})
    return out


def load(path=PATH):
    with open(path, encoding='utf-8') as f:
        return parse(f.read())


def sections_for(version, sections=None):
    """The sections of this version's minor release ('2.13.1' -> every '## 2.13…' section)."""
    mm = minor(version)
    return [s for s in (sections if sections is not None else load()) if s['v'] == mm or s['v'].startswith(mm + '.')]


def markdown(sections):
    return '\n\n'.join(f"### {s['title'][:1].upper() + s['title'][1:]}\n" + '\n'.join('- ' + i for i in s['items']) for s in sections)
