"""Pictures in many formats for importtest (python3 mkimages.py OUT)."""
import os, sys
from PIL import Image, ImageDraw
out = os.path.join(sys.argv[1] if len(sys.argv) > 1 else '/tmp/sf-e2e', 'img'); os.makedirs(out, exist_ok=True)
def pic(color, size=(300, 200)):
    im = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([20, 20, size[0] - 21, size[1] - 21], fill=color); return im
red, green, blue = (220, 30, 30, 255), (30, 180, 60, 255), (40, 70, 220, 255)
pic(red).save(f'{out}/red.png')
pic(red).convert('RGB').save(f'{out}/red.jpg', quality=95)
pic(green).save(f'{out}/green.webp', lossless=True)
pic(blue).convert('RGB').save(f'{out}/blue.bmp')
pic(blue).save(f'{out}/blue.ico', sizes=[(128, 128)])
pic(red).convert('RGB').save(f'{out}/red_lzw.tif', compression='tiff_lzw')
pic(green).save(f'{out}/green_raw.tif', compression=None)
pic(blue).convert('RGB').save(f'{out}/blue_packbits.tif', compression='packbits')
pic(red).convert('RGB').save(f'{out}/red_deflate.tif', compression='tiff_adobe_deflate')
pic(green).convert('L').save(f'{out}/gray.tif', compression='tiff_lzw')
frames = [pic(c) for c in (red, green, blue)]
frames[0].save(f'{out}/anim.gif', save_all=True, append_images=frames[1:], duration=[250, 250, 250], loop=0, disposal=2)
for i, f in enumerate(frames): f.save(f'{out}/seq_{i + 1}.png')
open(f'{out}/star.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="20" y="20" width="160" height="160" fill="#1e3cdc"/></svg>')
pic(red, (1600, 1200)).save(f'{out}/big.png')
print('pictures in', out)
