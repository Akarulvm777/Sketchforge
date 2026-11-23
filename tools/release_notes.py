#!/usr/bin/env python3
"""Print the GitHub release notes of a version (default: package.json): its CHANGELOG.md sections + how to install.

    python3 tools/release_notes.py [version] > notes.md
Exits with an error if CHANGELOG.md has no section for that version (a release must say what changed).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import changelog

INSTALL = """## Install
- **Windows**: `Sketchforge-Setup-….exe`, run it (Windows may say "unknown publisher": More info → Run anyway).
- **Mac**: `…-mac-arm64.dmg` for Apple Silicon (M1/M2/M3…), `…-mac-x64.dmg` for Intel. Drag Nexilune to Applications, then right-click → Open the first time (the app is not notarised).
- **Android**: open the `.apk` on the phone / tablet (allow "install unknown apps" when asked).
- **Linux**: the `.AppImage` (make it executable, then run it).
- **iPad / iPhone**: the web app (website link, Safari → Share → Add to Home Screen). Test app: `…-ios-unsigned.ipa` (added a few minutes later), installed with AltStore or Sideloadly (works 7 days, then install again).
- Already installed (2.4 or newer)? The app updates itself."""


def notes(version):
    secs = changelog.sections_for(version)
    if not secs:
        raise SystemExit(f'CHANGELOG.md has no "## {changelog.minor(version)}: …" section for {version}')
    return f"## What's new in {version}\n\n" + changelog.markdown(secs) + '\n\n' + INSTALL + '\n\nAll updates: [CHANGELOG.md](https://github.com/Akarulvm777/Sketchforge/blob/master/CHANGELOG.md)\n'


if __name__ == '__main__':
    v = sys.argv[1] if len(sys.argv) > 1 else json.load(open(os.path.join(changelog.ROOT, 'package.json'), encoding='utf-8'))['version']
    sys.stdout.write(notes(v))
