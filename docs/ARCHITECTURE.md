# Sketchforge architecture review (November 2026, before 3.3)

Sketchforge is one static web app: 79 source modules in `parts/` (about 16,700 lines) concatenated by `build.py`
into `app.js`, which runs inside one shared scope (an IIFE). No bundler, no framework, no runtime dependency.
This review lists what made updates break, what was cleaned up, and the rules for new code.

## What made updates break

| Problem | Where it showed | Status |
|---|---|---|
| **Modules replacing core functions by hand** (`x = function () { … x0() … }`): about 50 places, up to 5 replacements of the same function (`refreshProps`), each depending on start-up order and able to skip the others. | 3.2: the saved file was recorded as a draft because two `saveDocument` replacements ran in the wrong order; closing files depended on wrapper order. | **Fixed for 22 sites** with `hookAfter` (below). About 25 remain where a module changes arguments or skips the original (stroke engine: `beginStroke`, `segment`, `endStroke`; `docClose`, `newDocument`, `openDocumentFile`, `setMode` guard…). |
| **One start-up line with 67 calls**: one module throwing stopped every module after it, silently. | A single bug could leave half of the app without menus or tools. | **Fixed**: `STARTUP` list in `p11_main`, each module starts on its own, failures go to `window.__sfStartErrors` and a unit test fails on any. |
| **Version numbers changed with a text replace** in four files. | 3.0.1–3.2.0 changed the Electron dev dependency (`^33.0.0` → `^33.1.1`) by accident. | **Fixed**: `tools/bump_version.py X.Y.Z` edits only the exact fields. |
| **Copies of the same helper** (5 HTML escapers, 31 `try { localStorage… } catch`). | Small differences (one escaper missed `>`). | Escapers **merged** into `escHtml`. `prefs` added; old storage code moves to it as files are touched. |
| **Background jobs with their own "is the user busy?" logic** (session save, auto-save, time-lapse, tool tuner, recent files). | 3.1.1: they started while the pen hovered; 3.2: saving waited for a time-lapse picture. | Fixed case by case (any input counts as busy; saving never waits). **Next**: one shared idle queue. |
| **Tests that click tabs by position and wait fixed times.** | The Home tab shifted every "first tab" click; a longer quiet time broke a 4.5 s wait. | Home tab moved outside the file-tab bar; waits lengthened. **Next**: tests should wait for a state, not a time. |
| **Defensive `typeof x === 'function'` checks** (about 100). | Hide missing functions instead of failing. | Left as is (they let optional modules load in any build); new code calls directly when the module is in `STARTUP`. |
| **Very large modules** (`p04_brush` 1,000 lines, `p10z_addons` 920, `p10w_csfeatures` 800). | Hard to change one part safely. | **Next**: split by topic (brush engine core / tips and textures / pressure; .sut reader / import UI). |

## Rules for new code

1. **Add behaviour after a core function with `hookAfter(name, fn, order)`** (`p00b_core`). The function must be in
   `HOOKABLE` (add it there: one getter / setter line). Lower `order` runs first; same order = registration order.
   Replace a function by hand only when the original must be skipped or its arguments changed, and say why in a
   comment.
2. **Start a module from the `STARTUP` list** in `p11_main`, after the modules it builds on.
3. **Settings**: `prefs.get / set / json / setJson` (keys without the `sketchforge.` prefix). Bump a key's suffix
   (`.v2`) when its format changes.
4. **HTML from text**: `escHtml(text)`, never string concatenation of user text.
5. **Versions**: `python3 tools/bump_version.py X.Y.Z` (semantic versioning: bug fixes = patch, features = minor),
   then the `## X.Y: …` section in `CHANGELOG.md`, then `npm test`.
6. **A new pure function gets a unit test** (`tools/tests/unit.cjs`); a new feature gets an e2e test in
   `tools/e2e/` added to `run_all.sh`.
7. **Never full-page work during a stroke** (see CLAUDE.md, Performance) and **never `getImageData` on a layer
   canvas** (read through a small canvas: the browser would move the whole layer to slow memory).
