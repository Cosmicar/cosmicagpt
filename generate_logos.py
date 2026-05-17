"""
Genera todos los tamaños de logo necesarios para el proyecto Cósmica
a partir de una imagen fuente (new_logo.png) que debe estar en el mismo directorio.

Uso:
  python generate_logos.py

Requiere:
  pip install Pillow
"""

from PIL import Image, ImageDraw
import io
import os
import shutil

BASE_DIR = r"c:\Users\Cristian Aliaga\Desktop\loscosmicos\cosmica\cosmicagpt"
APP_ASSETS_DIR = os.path.join(BASE_DIR, "apps", "cosmica-app", "assets")

# Buscar imagen fuente
source_candidates = ["new_logo.png", "new_logo.jpg", "new_logo.webp"]
source_path = None
for candidate in source_candidates:
    p = os.path.join(BASE_DIR, candidate)
    if os.path.exists(p):
        source_path = p
        break

if not source_path:
    print("ERROR: No se encontró ninguna imagen fuente (new_logo.png, new_logo.jpg, new_logo.webp)")
    print("Coloca la nueva imagen como 'new_logo.png' en:", BASE_DIR)
    exit(1)

print(f"Usando imagen fuente: {source_path}")
img_orig = Image.open(source_path).convert("RGBA")
w, h = img_orig.size
print(f"Tamaño original: {w}x{h}")

# Recortar al cuadrado si no lo es
if w != h:
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img_orig = img_orig.crop((left, top, left + side, top + side))
    print(f"Recortado a: {img_orig.size}")

def save_png(img, path, size):
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(path, "PNG", optimize=True)
    print(f"  ✓ {path} ({size}x{size})")

def save_webp(img, path, size):
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(path, "WEBP", quality=92)
    print(f"  ✓ {path} ({size}x{size} WebP)")

def save_ico(img, path):
    """Genera favicon.ico con múltiples tamaños"""
    sizes = [16, 32, 48, 64]
    icons = [img.resize((s, s), Image.LANCZOS) for s in sizes]
    icons[0].save(path, format="ICO", sizes=[(s, s) for s in sizes],
                  append_images=icons[1:])
    print(f"  ✓ {path} (ICO multi-size)")

def make_rounded(img, radius_pct=0.2):
    """Crea versión con esquinas redondeadas (para maskable icon)"""
    img = img.copy().convert("RGBA")
    size = img.size[0]
    radius = int(size * radius_pct)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    return result

def make_with_background(img, bg_color=(6, 10, 18, 255), padding_pct=0.15):
    """Agrega fondo oscuro con padding (para maskable icons)"""
    size = img.size[0]
    padded_size = int(size * (1 - padding_pct * 2))
    result = Image.new("RGBA", (size, size), bg_color)
    img_resized = img.resize((padded_size, padded_size), Image.LANCZOS)
    offset = (size - padded_size) // 2
    result.paste(img_resized, (offset, offset), img_resized)
    return result

print("\n=== Generando logos del directorio raíz ===")

# cosmica-logo.png (512x512 - el principal)
save_png(img_orig, os.path.join(BASE_DIR, "cosmica-logo.png"), 512)

# cosmica-logo.webp (optimizado)
save_webp(img_orig, os.path.join(BASE_DIR, "cosmica-logo.webp"), 128)

# apple-touch-icon.png (180x180)
save_png(img_orig, os.path.join(BASE_DIR, "apple-touch-icon.png"), 180)

# icon-512.png (raíz)
save_png(img_orig, os.path.join(BASE_DIR, "icon-512.png"), 512)

# favicon.ico
save_ico(img_orig, os.path.join(BASE_DIR, "favicon.ico"))

print("\n=== Generando assets de la Cosmica App ===")

# icon-192.png (app assets)
save_png(img_orig, os.path.join(APP_ASSETS_DIR, "icon-192.png"), 192)

# icon-512.png (app assets)
save_png(img_orig, os.path.join(APP_ASSETS_DIR, "icon-512.png"), 512)

print("\n=== Generando SVG logo para navbar ===")
# Crear un SVG que embebe el PNG como base64 data URI
import base64

img_192 = img_orig.resize((192, 192), Image.LANCZOS)
buf = io.BytesIO()
img_192.save(buf, format="PNG")
b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")

svg_icon_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <image href="data:image/png;base64,{b64_data}" width="192" height="192"/>
</svg>'''

svg_icon_path = os.path.join(APP_ASSETS_DIR, "icon.svg")
with open(svg_icon_path, "w") as f:
    f.write(svg_icon_content)
print(f"  ✓ {svg_icon_path} (SVG con PNG embebido)")

# favicon.svg también
svg_favicon_path = os.path.join(APP_ASSETS_DIR, "favicon.svg")
img_32 = img_orig.resize((32, 32), Image.LANCZOS)
buf32 = io.BytesIO()
img_32.save(buf32, format="PNG")
b64_32 = base64.b64encode(buf32.getvalue()).decode("utf-8")

svg_favicon_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <image href="data:image/png;base64,{b64_32}" width="32" height="32"/>
</svg>'''
with open(svg_favicon_path, "w") as f:
    f.write(svg_favicon_content)
print(f"  ✓ {svg_favicon_path} (favicon SVG)")

print("\n=== Generando Data URI para tickets ===")
# Generar data URI del logo a 120x120 para usar en tickets impresos
img_ticket = img_orig.resize((120, 120), Image.LANCZOS)
buf_ticket = io.BytesIO()
img_ticket.save(buf_ticket, format="PNG")
b64_ticket = base64.b64encode(buf_ticket.getvalue()).decode("utf-8")
data_uri_ticket = f"data:image/png;base64,{b64_ticket}"

# Guardar el data URI en un archivo txt para referencia
data_uri_path = os.path.join(BASE_DIR, "cosmica-logo.datauri.txt")
with open(data_uri_path, "w") as f:
    f.write(data_uri_ticket)
print(f"  ✓ {data_uri_path} (Data URI para tickets, {len(data_uri_ticket)} chars)")

print("\n✅ Todos los logos generados exitosamente!")
print("\nResumen de archivos actualizados:")
print("  Raíz del proyecto:")
print("    - cosmica-logo.png (512x512)")
print("    - cosmica-logo.webp (128x128)")
print("    - apple-touch-icon.png (180x180)")
print("    - icon-512.png (512x512)")
print("    - favicon.ico (multi-size)")
print("    - cosmica-logo.datauri.txt")
print("  apps/cosmica-app/assets/:")
print("    - icon-192.png (192x192)")
print("    - icon-512.png (512x512)")
print("    - icon.svg")
print("    - favicon.svg")
