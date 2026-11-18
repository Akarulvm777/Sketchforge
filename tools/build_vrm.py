#!/usr/bin/env python3
"""Builds vroid3d.js (the posable VRoid characters of the 3D panel) from VRoid Studio .vrm files.

Usage: python3 tools/build_vrm.py female.vrm male.vrm      (needs Pillow)

Each .vrm (a glTF binary) is trimmed for the app: the face expression shapes (morph targets), spring bones, the
thumbnail and unused data are removed, textures are scaled down (max TEX px; JPEG when opaque, PNG when they have
transparency). The skeleton, skin weights, UVs and materials are kept; the app maps the VRM humanoid bones onto
its own skeleton when the model is loaded (parts/p10yb_vrm.js).
The models are by bluegi (the Sketchforge author), who allowed redistribution and modification inside Sketchforge:
the licence fields of the trimmed copies say so (credit: bluegi).
"""
import base64, io, json, os, struct, sys
from PIL import Image

TEX = 1024           # longest side of the body / hair textures
TEX_SMALL = 512      # face parts, eyes
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'vroid3d.js')


def read_glb(path):
    b = open(path, 'rb').read()
    if b[:4] != b'glTF':
        sys.exit(path + ': not a .vrm / .glb file')
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', b[o:o + 4])[0]
    return j, b[o + 8:o + 8 + bl]


def view_bytes(j, binc, vi):
    v = j['bufferViews'][vi]
    o = v.get('byteOffset', 0)
    return binc[o:o + v['byteLength']]


def shrink_image(data, small):
    im = Image.open(io.BytesIO(data))
    im.load()
    limit = TEX_SMALL if small else TEX
    if max(im.size) > limit:
        k = limit / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getextrema()[3][0] < 255
    out = io.BytesIO()
    if has_alpha:
        im.convert('RGBA').save(out, 'PNG', optimize=True)
        return out.getvalue(), 'image/png'
    im.convert('RGB').save(out, 'JPEG', quality=88, optimize=True)
    return out.getvalue(), 'image/jpeg'


def trim(path):
    j, binc = read_glb(path)
    ext = j.get('extensions', {})
    if 'VRMC_vrm' not in ext and 'VRM' not in ext:
        sys.exit(path + ': no VRM humanoid data (export it from VRoid Studio as .vrm)')
    # --- drop what the app does not use ---
    for m in j['meshes']:
        m.pop('weights', None); m.pop('extras', None)
        for p in m['primitives']:
            p.pop('targets', None); p.pop('extras', None)
            for a in list(p['attributes']):
                if a not in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'):
                    del p['attributes'][a]
    for k in ('VRMC_springBone', 'VRMC_node_constraint', 'VRMC_vrm_animation'):
        ext.pop(k, None)
    if 'VRMC_vrm' in ext:
        v = ext['VRMC_vrm']
        v.pop('expressions', None); v.pop('lookAt', None); v.pop('firstPerson', None)
        meta = v.setdefault('meta', {})
        meta.pop('thumbnailImage', None)
        # the author (bluegi) allowed Sketchforge to redistribute and modify these models
        meta.update({'avatarPermission': 'everyone', 'allowRedistribution': True,
                     'modification': 'allowModificationRedistribution', 'creditNotation': 'required'})
        meta['otherLicenseUrl'] = 'https://github.com/Akarulvm777/Sketchforge'
    else:
        v = ext['VRM']
        for k in ('blendShapeMaster', 'secondaryAnimation', 'firstPerson'):
            v.pop(k, None)
        meta = v.setdefault('meta', {})
        meta.pop('texture', None)
        meta.update({'allowedUserName': 'Everyone', 'licenseName': 'Redistribution_Prohibited' if False else 'Other'})
    j['extensionsUsed'] = [e for e in j.get('extensionsUsed', []) if e in ext or e.startswith('KHR_')]
    for m in j.get('materials', []):  # MToon settings are not used (the app shades the model itself)
        m.get('extensions', {}).pop('VRMC_materials_mtoon', None)
        m.get('extensions', {}).pop('KHR_materials_emissive_strength', None)
    j['extensionsUsed'] = [e for e in j['extensionsUsed'] if e not in ('VRMC_materials_mtoon', 'KHR_materials_emissive_strength')]

    # --- which images are still used, and by which material (face parts can be smaller) ---
    used_tex = {}
    for m in j.get('materials', []):
        small = any(w in (m.get('name') or '') for w in ('EYE', 'FACE', 'Eye', 'Brow', 'Mouth'))
        pbr = m.get('pbrMetallicRoughness', {})
        keep = {}
        if 'baseColorTexture' in pbr:
            keep['baseColorTexture'] = pbr['baseColorTexture']
        m['pbrMetallicRoughness'] = {k: pbr[k] for k in ('baseColorFactor',) if k in pbr} | keep
        m['pbrMetallicRoughness'].update({'metallicFactor': 0, 'roughnessFactor': 1})
        for k in ('normalTexture', 'emissiveTexture', 'occlusionTexture', 'emissiveFactor'):
            m.pop(k, None)
        if 'baseColorTexture' in keep:
            used_tex[keep['baseColorTexture']['index']] = small and used_tex.get(keep['baseColorTexture']['index'], True)

    # --- rebuild one compact buffer: only the accessors / images still referenced ---
    acc_used = set()
    for m in j['meshes']:
        for p in m['primitives']:
            acc_used.update(p['attributes'].values())
            if 'indices' in p:
                acc_used.add(p['indices'])
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            acc_used.add(s['inverseBindMatrices'])
    new_bin = bytearray(); new_views = []; view_map = {}

    def add_view(data, extra):
        while len(new_bin) % 4:
            new_bin.append(0)
        new_views.append(dict(extra, buffer=0, byteOffset=len(new_bin), byteLength=len(data)))
        new_bin.extend(data)
        return len(new_views) - 1

    acc_map, new_acc = {}, []
    for ai in sorted(acc_used):
        a = dict(j['accessors'][ai])
        vi = a['bufferView']
        if vi not in view_map:
            old = j['bufferViews'][vi]
            view_map[vi] = add_view(view_bytes(j, binc, vi), {k: old[k] for k in ('byteStride', 'target') if k in old})
        a['bufferView'] = view_map[vi]
        acc_map[ai] = len(new_acc); new_acc.append(a)
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = acc_map[p['indices']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]

    tex_used_images = {}
    for ti, small in used_tex.items():
        tex_used_images.setdefault(j['textures'][ti]['source'], small)
    img_map, new_imgs, kb = {}, [], 0
    for ii, small in sorted(tex_used_images.items()):
        data, mime = shrink_image(view_bytes(j, binc, j['images'][ii]['bufferView']), small)
        kb += len(data) // 1024
        img_map[ii] = len(new_imgs)
        new_imgs.append({'name': j['images'][ii].get('name', ''), 'mimeType': mime, 'bufferView': add_view(data, {})})
    tex_map, new_tex = {}, []
    for ti in sorted(used_tex):
        t = dict(j['textures'][ti]); t['source'] = img_map[t['source']]
        tex_map[ti] = len(new_tex); new_tex.append(t)
    for m in j.get('materials', []):
        bt = m['pbrMetallicRoughness'].get('baseColorTexture')
        if bt:
            bt['index'] = tex_map[bt['index']]
            bt.pop('extensions', None)
    j['accessors'], j['bufferViews'], j['images'], j['textures'] = new_acc, new_views, new_imgs, new_tex
    j['buffers'] = [{'byteLength': len(new_bin)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    while len(new_bin) % 4:
        new_bin.append(0)
    glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(new_bin))
    glb += struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(new_bin)) + b'BIN\0' + bytes(new_bin)
    print(f'{os.path.basename(path)}: {os.path.getsize(path) // 1024} KB -> {len(glb) // 1024} KB (textures {kb} KB)')
    return glb


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    female, male = trim(sys.argv[1]), trim(sys.argv[2])
    js = ('/* Generated by tools/build_vrm.py from VRoid Studio models by bluegi (redistribution and modification allowed for Sketchforge). Do not edit. */\n'
          'var SF_VRM = { credit: "VRoid models by bluegi", female: "' + base64.b64encode(female).decode() +
          '", male: "' + base64.b64encode(male).decode() + '" };\n')
    open(OUT, 'w').write(js)
    print('wrote vroid3d.js', len(js) // 1024, 'KB')


if __name__ == '__main__':
    main()
