#!/usr/bin/env python3
"""Release checks (Python unittest, no browser): the version is the same everywhere, the changelog says what changed,
README only presents the project, app.js is built from the current parts/, and every file the app loads is packaged.

    python3 tools/tests/test_release.py      (part of `npm test`; CI runs it before building a release)
"""
import glob, json, os, re, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import changelog, release_notes  # noqa: E402


def read(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()


PKG = json.loads(read('package.json'))
VERSION = PKG['version']


class Version(unittest.TestCase):
    def test_index_html(self):
        html = read('index.html')
        self.assertIn(f'<title>Inkvessa {VERSION}</title>', html)
        self.assertIn(f'Inkvessa v{VERSION}', html, 'status bar text')
        found = set(re.findall(r'\?v=([\w.]+)', html))
        self.assertEqual(found, {VERSION}, 'every ?v= in index.html (style.css, app.js, cloud files)')

    def test_service_worker_cache(self):
        self.assertIn(f"const CACHE = 'sketchforge-v{VERSION}';", read('sw.js'), 'sw.js CACHE (installed web apps keep old code otherwise)')

    def test_app_js_version(self):
        self.assertIn(f"const APP_VERSION = '{VERSION}';", read('app.js')[:300], 'run python3 build.py')

    def test_release_date(self):
        self.assertIn(VERSION, json.loads(read('release-dates.json')), 'run python3 build.py and commit release-dates.json')


class Changelog(unittest.TestCase):
    def test_this_version_has_notes(self):
        secs = changelog.sections_for(VERSION)
        self.assertTrue(secs, f'CHANGELOG.md needs a "## {changelog.minor(VERSION)}: …" section')
        self.assertTrue(all(s['items'] for s in secs), 'every changelog section lists its changes ("- " lines)')

    def test_newest_first(self):
        vs = [s['v'] for s in changelog.load()]
        self.assertEqual(vs, sorted(vs, key=changelog.vkey, reverse=True))

    def test_release_notes(self):
        n = release_notes.notes(VERSION)
        self.assertIn(f"What's new in {VERSION}", n)
        self.assertIn('## Install', n)
        with self.assertRaises(SystemExit):
            release_notes.notes('0.0.1')

    def test_parse(self):
        secs = changelog.parse('# Changelog\n\n## 3.1: big thing\n- **New:** a\n- b\ntext\n\n## 3.0.2: fix\n- c\n')
        self.assertEqual([(s['v'], s['title'], s['items']) for s in secs], [('3.1', 'big thing', ['New: a', 'b']), ('3.0.2', 'fix', ['c'])])
        self.assertEqual([s['v'] for s in changelog.sections_for('3.0.5', secs)], ['3.0.2'])


class Readme(unittest.TestCase):
    def test_only_presents_the_project(self):
        md = read('README.md')
        self.assertFalse(re.search(r'^## \d+\.\d+', md, re.M), 'version history belongs in CHANGELOG.md, not README.md')
        self.assertNotRegex(md.split('\n')[0], r'\d+\.\d+', 'no version number in the README title')


class Build(unittest.TestCase):
    def test_app_js_is_built_from_parts(self):
        app = read('app.js')
        parts = sorted(glob.glob(os.path.join(ROOT, 'parts', 'p*.js')))
        pos = 0
        for p in parts:
            with open(p, encoding='utf-8') as f:
                i = app.find(f.read(), pos)
            self.assertGreaterEqual(i, 0, f'{os.path.basename(p)} changed since app.js was built: run python3 build.py')
            pos = i

    def test_packaged_files(self):
        assets = re.search(r'const ASSETS = \[(.*?)\];', read('sw.js')).group(1)
        files = PKG['build']['files']
        for a in re.findall(r"'([^']+)'", assets):
            if a == './':
                continue
            self.assertTrue(os.path.exists(os.path.join(ROOT, a)), f'{a} (sw.js ASSETS) is missing')
            self.assertIn(a, files, f'{a} is loaded by the app but not packaged (package.json build.files)')


if __name__ == '__main__':
    unittest.main(verbosity=2)
