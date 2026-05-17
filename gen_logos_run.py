# -*- coding: utf-8 -*-
import sys, io as _io, os, base64
from PIL import Image

sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = r'c:\Users\Cristian Aliaga\Desktop\loscosmicos\cosmica\cosmicagpt'
APP_ASSETS_DIR = os.path.join(BASE_DIR, 'apps', 'cosmica-app', 'assets')

source_path = os.path.join(BASE_DIR, 'new_logo.png')
img_orig = Image.open(source_path).convert('RGBA')
print('Fuente:', img_orig.size)

def save_png(img, path, size):
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(path, 'PNG', optimize=True)
    print('PNG OK:', os.path.basename(path), size)

def save_webp(img, path, size):
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(path, 'WEBP', quality=92)
    print('WEBP OK:', os.path.basename(path), size)

def save_ico(img, path):
    sizes = [16, 32, 48, 64]
    icons = [img.resize((s, s), Image.LANCZOS) for s in sizes]
    icons[0].save(path, format='ICO', sizes=[(s, s) for s in sizes], append_images=icons[1:])
    print('ICO OK:', os.path.basename(path))

# Root logos
save_png(img_orig, os.path.join(BASE_DIR, 'cosmica-logo.png'), 512)
save_webp(img_orig, os.path.join(BASE_DIR, 'cosmica-logo.webp'), 128)
save_png(img_orig, os.path.join(BASE_DIR, 'apple-touch-icon.png'), 180)
save_png(img_orig, os.path.join(BASE_DIR, 'icon-512.png'), 512)
save_ico(img_orig, os.path.join(BASE_DIR, 'favicon.ico'))

# App assets
save_png(img_orig, os.path.join(APP_ASSETS_DIR, 'icon-192.png'), 192)
save_png(img_orig, os.path.join(APP_ASSETS_DIR, 'icon-512.png'), 512)

# SVG icon.svg con PNG embebido
img_192 = img_orig.resize((192, 192), Image.LANCZOS)
buf = _io.BytesIO()
img_192.save(buf, format='PNG')
b64_data = base64.b64encode(buf.getvalue()).decode('utf-8')
svg_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">'
svg_icon += '<image href="data:image/png;base64,' + b64_data + '" width="192" height="192"/></svg>'
with open(os.path.join(APP_ASSETS_DIR, 'icon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_icon)
print('SVG OK: icon.svg')

# favicon.svg
img_32 = img_orig.resize((32, 32), Image.LANCZOS)
buf32 = _io.BytesIO()
img_32.save(buf32, format='PNG')
b64_32 = base64.b64encode(buf32.getvalue()).decode('utf-8')
svg_fav = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
svg_fav += '<image href="data:image/png;base64,' + b64_32 + '" width="32" height="32"/></svg>'
with open(os.path.join(APP_ASSETS_DIR, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_fav)
print('SVG OK: favicon.svg')

# Data URI para tickets (120x120)
img_ticket = img_orig.resize((120, 120), Image.LANCZOS)
buf_t = _io.BytesIO()
img_ticket.save(buf_t, format='PNG')
b64_ticket = base64.b64encode(buf_t.getvalue()).decode('utf-8')
data_uri = 'data:image/png;base64,' + b64_ticket
with open(os.path.join(BASE_DIR, 'cosmica-logo.datauri.txt'), 'w', encoding='utf-8') as f:
    f.write(data_uri)
print('DataURI OK, len:', len(data_uri))

print('ALL DONE')
