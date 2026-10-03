"""Guia visual do DIAG: embute src/guia-visual.html no DIAG como window.GUIA_HTML (abre num modal,
sem outra página — como o guia do processo do ATDAU Implantação).

Uso:
  python tools/build-guia.py                     embute no DIAG usando os prints de src/guia-prints/*.webp
  python tools/build-guia.py --prints <pasta>    antes, converte os JPEG do spec de prints em WebP leves
  python tools/build-guia.py --pagina <arquivo>  também grava uma página avulsa (para publicar como artifact)

Os prints vêm de: SHOT_DIR=<pasta> npx playwright test --project=prints
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIAG = ROOT / 'ATDAU_DIAG_interativo.html'
SRC = ROOT / 'src' / 'guia-visual.html'
PRINTS = ROOT / 'src' / 'guia-prints'
LARGOS = {'03-contexto-lente', '11-mapa-sintese'}   # prints de tela inteira: mais resolução

def arg(nome):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else None

if arg('--prints'):
    from PIL import Image
    PRINTS.mkdir(exist_ok=True)
    for f in sorted(pathlib.Path(arg('--prints')).glob('*.jpg')):
        im = Image.open(f).convert('RGB')
        w = 1100 if f.stem in LARGOS else 760
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(PRINTS / (f.stem + '.webp'), 'WEBP', quality=62, method=6)
    print('prints convertidos ->', PRINTS.relative_to(ROOT))

src = SRC.read_text(encoding='utf-8')
def img(m):
    return 'data:image/webp;base64,' + base64.b64encode((PRINTS / (m.group(1) + '.webp')).read_bytes()).decode('ascii')
html = re.sub(r'\{\{img:([\w-]+)\}\}', img, src)

if arg('--pagina'):
    pathlib.Path(arg('--pagina')).write_text(html, encoding='utf-8')
    print('pagina avulsa ->', arg('--pagina'))

# Versão para o modal (shadow DOM): sem <title>/<meta>/<link>; tokens em :host; só tema claro (o DIAG é claro).
m = html
m = re.sub(r'<title>.*?</title>\s*|<meta [^>]*>\s*|<link [^>]*>\s*', '', m)
m = re.sub(r'@media \(prefers-color-scheme: dark\)\{.*?\}\}\n', '', m, flags=re.S)
m = re.sub(r':root\[data-theme="dark"\]\{.*?\}\n', '', m, flags=re.S)
m = m.replace(':root{', ':host{', 1).replace('\nbody{', '\n.wrap{', 1)
assert ':root' not in m and 'prefers-color-scheme' not in m, 'limpeza do tema falhou'

import json
lit = json.dumps(m, ensure_ascii=False).replace('</', r'<\/').encode('utf-8')   # seguro dentro de <script>
diag = DIAG.read_bytes()
rx = re.compile(rb'(/\*GUIA_INI\*/)(.*?)(/\*GUIA_FIM\*/)', re.S)
mm = rx.search(diag)
if not mm:
    sys.exit('marcadores GUIA_INI/GUIA_FIM não encontrados no DIAG')
DIAG.write_bytes(diag[:mm.start(2)] + lit + diag[mm.end(2):])
print(f'embutido no DIAG: {len(lit) // 1024} KB')
