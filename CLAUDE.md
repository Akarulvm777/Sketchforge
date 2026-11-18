# CLAUDE.md — Sketchforge

Instructions de passation pour Claude Code. À lire avant toute modification.

## 1. Contexte (important)

- Sketchforge est une application de dessin et d'animation (inspirée de Clip Studio et d'Adobe Animate, avec du code 100 % original). Elle tourne dans le navigateur ou en PWA, avec Electron pour le bureau.
- **Restauration du 17/11/2026** : ce dépôt part du dernier instantané disponible, **v2.0.0 (17/11/2026, 02:36)**. Une version plus récente, développée dans une session Claude, a été perdue. Son contenu est **inconnu** : il ne faut **pas** inventer ces fonctionnalités. Elles seront redécrites par l'utilisateur et réimplémentées une par une (voir § 7).
- L'utilisateur est francophone mais souhaite des réponses en anglais. Code et commentaires en anglais.

## 2. Lancer

```bash
python3 build.py              # parts/*.js -> app.js + node --check (OBLIGATOIRE après toute modif JS)
python3 -m http.server 8000   # puis http://localhost:8000 (le service worker exige http)
npm install && npm start      # bureau (Electron)
npm run dist                  # installeurs (electron-builder)
```

`index.html` s'ouvre aussi en `file://`, mais sans service worker (et le 3D peut être bloqué selon le navigateur).

## 3. Architecture

Il n'y a ni bundler, ni framework, ni dépendance runtime. Un seul script global :

| Fichier | Rôle |
|---|---|
| `parts/p*.js` | **Source.** Concaténés par ordre alphabétique de nom de fichier. L'ordre compte : les fichiers partagent la portée globale (`state`, `compositeFrame`, …). |
| `app.js` | **Généré** par `build.py`. Ne jamais l'éditer à la main. Il est versionné pour que l'app tourne sans étape de build. |
| `index.html` | DOM (menus, panneaux, palettes), charge `style.css?v=…` et `app.js?v=…`. |
| `style.css` | Tout le style. |
| `three3d.js` | Bundle three.js (MIT, voir `THREE-LICENSE.txt`), chargé **à la demande** par `load3D()` (p10y). Expose `SF3D`. |
| `models3d.js` | **Généré** par `tools/build_models.mjs` depuis `assets/HumanLowPolyBaseMesh.fbx` : mannequins homme / femme riggés (16 joints, mesh quantifié, poids de skin), chargé à la demande après `three3d.js`. Expose `SF_MODELS`. Ne pas éditer à la main. |
| `sw.js` | Service worker network-first, cache `sketchforge-vXXX`. |
| `main.js` | Coquille Electron (contextIsolation, sandbox, dialogue « modifications non enregistrées »). |
| `tools/smoke.py` | Test de fumée headless (Playwright). |
| `tools/build_models.mjs` | Génère `models3d.js` (`npm install` puis `npm run build:models`). Les repères des joints et les rayons des os sont en haut du fichier. |

Modules dans `parts/` :

- `p00_head` : état global, utilitaires.
- `p02_layers` : calques, cels.
- `p03_history_view` : undo/redo, vue (zoom, rotation, flip).
- `p04_brush` : moteur de pinceau, pression, stabilisateur.
- `p05_selection` : sélections.
- `p06_transform` : outil Move, transformations, tweens.
- `p07_ui` : palettes, propriétés d'outil.
- `p08_ops` : commandes.
- `p09_timeline` : timeline, onion skin, lecture.
- `p10_docs_export` : save/open `.sketchforge`, exports GIF, WebM, PNG et ZIP.
- `p10o_multidoc` : plusieurs documents (onglets). Le document actif vit dans les globales (`state` pour les champs de `DOC_FIELDS`, `history`, `view`, `sel`, `layerSeq`, `layerCounter`, `dirty`, `TL.frames`, `aud`, `lightPins`) ; les autres sont rangés dans `rec.saved` (`docStash` / `docLoad`). `newDocument` et `openDocumentFile` appellent `docPrepareNew()` (nouvel onglet, sauf l'onglet vierge de démarrage). **Si tu ajoutes un état propre au document dans un autre module, ajoute-le à `docStash` / `docLoad` / `docBlankGlobals`.** Aussi : déplacer un document dans une nouvelle fenêtre (postMessage `sf-ready` / `sf-doc` / `sf-loaded`), et la « seconde vue » (vue live flottante, détachable dans une fenêtre).
- `p10p_anim` : light table, audio, page manager, export PSD, bouton 3D.
- `p10pp_psd` : ouverture PSD/PSB (lecteur maison : RGB / gris / CMJN, 8 / 16 bits, brut / RLE / ZIP, groupes aplatis, masques intégrés dans l'alpha, tolérant aux PSD dont l'en-tête annonce 16 bits mais dont les calques sont en 8 bits) et `.clip` (mini lecteur SQLite en lecture seule ; ouvre l'aperçu pleine taille stocké dans le fichier, donc une image aplatie). `openAnyDocument` aiguille selon l'extension ; `openLayersAsDocument` crée le document dans un nouvel onglet. L'export PSD est dans `p10p_anim` (avec écrêtage et noms Unicode `luni`).
- `p10pv_video` : référence vidéo et son. Calque vidéo = `layer.vref` (élément `<video>` muet + canvas) : `bindLayer` affiche `vref.canvas`, synchronisé sur la frame (temps = (frame − offset) / fps), lu pendant la lecture, jamais peint (`canPaint`), exclu de `compositeFrame` (donc des exports) sauf `opts.all`. « Convertir en frames » décode la vidéo en cels. Vidéo et audio embarqués dans le `.sketchforge` (`layers[i].vref.data`, `doc.audio`) jusqu'à 60 Mo, sinon « Relink video… ».
- `p10q_filters` : courbe de tons, balance des couleurs, gradient map, flou radial, Liquify.
- `p10r_pro` : règles, cases de manga, bulles, effets manga.
- `p10s_masks` : masques de calque.
- `p10t_symmetry` : bouton / popup / menu Symétrie (miroir, 4 axes, radial, kaléidoscope). La géométrie (`symMats`, `symLocal`) est dans `p10r_pro`, l'application aux traits et formes dans `p04_brush` (`stampAt`, `drawShapePreview`).
- `p10u_timelapse` : time-lapse, un par document (remis à zéro par New, sauvé dans le `.sketchforge` sous `timelapse`, restauré à l'ouverture ; `TL.gen` empêche les captures en retard d'un autre fichier d'y entrer). Modes : `canvas`, `view` (vue de travail : zoom, rotation, curseur, outil), `screen` (getDisplayMedia ; dans Electron, `setDisplayMediaRequestHandler` de `main.js`). Bouton REC on/off + ▾ options, préférences `sketchforge.tl.v1`.
- `p10v_workspace` : espaces de travail Dessin et Animation.
- `p10w_csfeatures` : clipping, verrou de transparence, calques référence et brouillon, menu Filtre, Select expand/shrink.
- `p10x_penset` : les 11 pens intégrés, avec des tips en base64 (lignes très longues : ne pas l'ouvrir en entier).
- `p10y_3d` : panneau 3D (mannequins riggés de `models3d.js`, repli sur un mannequin procédural, primitives, glTF et OBJ).
- `p10z_addons` : panneaux flottants et dockables, API add-ons (`Sketchforge.addBrush`, `addCommand`…), import `.sut`.
- `p10zz_customp` : menu « 🎨 Custom P » : thèmes de couleur (préréglages + couleurs perso, repeint toutes les couleurs de `style.css` via le CSSOM), icônes personnalisées (hook `customIcons` dans `icon()` de p00), reset. Clé `sketchforge.customp.v1`. Si tu ajoutes des couleurs en dur dans le CSS, elles sont repeintes automatiquement (gris → rampe du thème, cuivre / bleu ardoise → accent).
- `p11_main` : construction des menus (`data-cmd`), raccourcis, init, enregistrement du SW.

Il manque des numéros dans la séquence (pas de p01 ni p10a–o). C'est normal : l'ordre alphabétique suffit. Pour un nouveau module, choisis un nom qui le place après ses dépendances (ex. `p10t_xxx.js` se charge avant `p10u`).

Persistance locale : clés `localStorage` préfixées `sketchforge.` (`pen`, `tools2`, `layout.v1`…). Si un format change, bumpe le suffixe de la clé plutôt que de casser les données existantes.

## 4. Règles de travail

1. Modifie `parts/`, puis lance `python3 build.py`, puis `python3 tools/smoke.py`, puis commit. Une modification = un commit, avec `app.js` régénéré dans le même commit.
2. **Release** : bumpe la version de façon cohérente aux 4 endroits suivants :
   - `package.json` → `version`
   - `index.html` → `<title>`, `?v=` sur `style.css` et `app.js`, texte de la barre d'état
   - `sw.js` → `CACHE` (sinon les PWA installées gardent l'ancien code)
   - `README.md` → titre et une section changelog
3. Si tu ajoutes un fichier que l'app charge, ajoute-le aussi à `ASSETS` dans `sw.js` **et** à `build.files` dans `package.json`.
4. Interdit : ajouter une dépendance runtime ou un bundler sans accord de l'utilisateur. Le projet doit rester un dossier statique ouvrable tel quel.
5. Aucun asset, code ni nom de marque de Clip Studio ou d'Adobe. Les fichiers `.sut` et `.lmtl` sont lus uniquement via l'import utilisateur.
6. Ne recrée jamais `app.js` depuis une sortie d'outil tronquée : regénère-le toujours via `build.py`.

## 5. Tests

- `python3 tools/smoke.py` charge l'app, trace un trait, ouvre le panneau 3D, et échoue sur toute erreur JS non capturée ou si three.js ne se charge pas. Capture d'écran : `tools/smoke.png`. Si besoin, définis `CHROME_PATH` pour pointer vers un Chrome existant.
- Avant une release, faire une vérification manuelle : outils de dessin, undo/redo, calques, timeline et tween, save/open `.sketchforge`, export GIF et PNG, panneau 3D, panneaux flottants.

## 6. Corrections apportées lors de la restauration (17/11/2026)

- `build.py` : les chemins absolus `/home/claude/sf2` sont remplacés par des chemins relatifs au script, avec écriture en UTF-8 et LF.
- `package.json` : la version passe de `0.2.0` à `2.0.0`, et le script `build` est ajouté. **Bug corrigé** : `three3d.js` et `sw.js` manquaient dans `build.files`, donc le panneau 3D était cassé dans l'app Electron packagée.
- `README.md` : le titre passe de 0.2 à 2.0.
- Ajouts : `.gitignore`, `.gitattributes`, `tools/smoke.py`, `CLAUDE.md`.
- Vérifié : le build est identique aux sources, `node --check` passe, et le smoke test passe (dessin OK, 3D OK, 0 erreur JS).

## 7. Backlog

1. **Récupérer les fonctionnalités perdues** (priorité 1). Demander à l'utilisateur la liste des changements faits après la v2.0.0 (fonctions, bugs corrigés, UI). Créer une issue ou une entrée par élément, puis implémenter et tester un élément à la fois.
2. La section « Not yet » du README est partiellement obsolète (les outils manga, la 3D et l'audio existent désormais). À mettre à jour.
3. Les 11 pens intégrés viennent des `.sut` de l'utilisateur, et le mesh 3D (`assets/HumanLowPolyBaseMesh.fbx`) d'un pack fourni par l'utilisateur. Vérifier leurs licences avant toute distribution publique.
4. Il n'y a pas de tests unitaires. À envisager si le moteur de pinceau ou la timeline évoluent beaucoup.

## 8. Suivi Trello

- Tableau : https://trello.com/b/mU0URkCg/sketchforge (listes `ideas`, `To Do`, `Doing`, `Done`). Il n'y a pas de synchronisation automatique : c'est à toi de tenir le tableau à jour via le connecteur Trello.
- Une carte par élément de travail. Au début d'une tâche, déplace sa carte dans `Doing` (crée-la si elle n'existe pas). Après le push, déplace-la dans `Done` et ajoute le lien du commit dans la description ou en commentaire.
- Les idées non validées par l'utilisateur vont dans `ideas`. Ne crée pas de cartes pour des fonctionnalités perdues que l'utilisateur n'a pas décrites.
