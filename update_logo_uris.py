# -*- coding: utf-8 -*-
"""
Actualiza los data URI del logo en ticket-print.js con el logo real generado.
"""
import sys, io as _io, os, base64
from PIL import Image

sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = r'c:\Users\Cristian Aliaga\Desktop\loscosmicos\cosmica\cosmicagpt'
TICKET_PRINT_JS = os.path.join(BASE_DIR, 'apps', 'cosmica-app', 'components', 'ticket-print.js')

source_path = os.path.join(BASE_DIR, 'new_logo.png')
img_orig = Image.open(source_path).convert('RGBA')

# Logo 120x120 para tickets A4 (compact but crisp)
img_120 = img_orig.resize((120, 120), Image.LANCZOS)
buf120 = _io.BytesIO()
img_120.save(buf120, format='PNG', optimize=True)
b64_120 = base64.b64encode(buf120.getvalue()).decode('utf-8')
data_uri_120 = 'data:image/png;base64,' + b64_120

# Logo 80x80 para tickets térmicos
img_80 = img_orig.resize((80, 80), Image.LANCZOS)
buf80 = _io.BytesIO()
img_80.save(buf80, format='PNG', optimize=True)
b64_80 = base64.b64encode(buf80.getvalue()).decode('utf-8')
data_uri_80 = 'data:image/png;base64,' + b64_80

print('Data URI 120px len:', len(data_uri_120))
print('Data URI 80px len:', len(data_uri_80))

# Leer el archivo JS
with open(TICKET_PRINT_JS, 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazar el placeholder incorrecto del LOGO_DATA_URI
# El valor actual termina en '...0h//KPT+I2l+Q==';
# Buscamos la linea completa del const LOGO_DATA_URI

import re

# Reemplazar LOGO_DATA_URI
old_pattern_a4 = r"const LOGO_DATA_URI = 'data:image/png;base64,[^']*';"
new_a4 = "const LOGO_DATA_URI = '" + data_uri_120 + "';"
content_new = re.sub(old_pattern_a4, new_a4, content)
if content_new == content:
    print('ERROR: No se encontro LOGO_DATA_URI para reemplazar')
else:
    print('OK: LOGO_DATA_URI (A4) reemplazado')
content = content_new

# Reemplazar THERMAL_LOGO_URI
old_pattern_thermal = r"const THERMAL_LOGO_URI = 'data:image/png;base64,[^']*';"
new_thermal = "const THERMAL_LOGO_URI = '" + data_uri_80 + "';"
content_new = re.sub(old_pattern_thermal, new_thermal, content)
if content_new == content:
    print('ERROR: No se encontro THERMAL_LOGO_URI para reemplazar')
else:
    print('OK: THERMAL_LOGO_URI reemplazado')
content = content_new

# Guardar
with open(TICKET_PRINT_JS, 'w', encoding='utf-8') as f:
    f.write(content)

print('Archivo guardado:', TICKET_PRINT_JS)
print('DONE')
