"""Re-embute o Mapa-Síntese (src/mapa-sintese.html) no DIAG como window.MS_B64.

Uso:  python tools/embed-ms.py            (lê src/mapa-sintese.html, grava ATDAU_DIAG_interativo.html)
      python tools/embed-ms.py --extract  (caminho inverso: extrai o MS_B64 atual para src/mapa-sintese.html)

O DIAG continua single-file para o usuário; só o desenvolvimento passa a editar o Mapa-Síntese
como fonte legível em vez do base64. Trabalha em bytes: não mexe em codificação nem em fim de linha.
"""
import base64, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIAG = ROOT / "ATDAU_DIAG_interativo.html"
SRC = ROOT / "src" / "mapa-sintese.html"
RX = re.compile(rb'(window\.MS_B64\s*=\s*")([A-Za-z0-9+/=]+)(")')

diag = DIAG.read_bytes()
m = RX.search(diag)
if not m:
    sys.exit("MS_B64 não encontrado no DIAG")

if "--extract" in sys.argv:
    SRC.parent.mkdir(exist_ok=True)
    SRC.write_bytes(base64.b64decode(m.group(2)))
    print(f"extraido -> {SRC.relative_to(ROOT)} ({SRC.stat().st_size} bytes)")
else:
    b64 = base64.b64encode(SRC.read_bytes())
    DIAG.write_bytes(diag[: m.start(2)] + b64 + diag[m.end(2):])
    print(f"embutido <- {SRC.relative_to(ROOT)} ({len(b64)} chars base64)")
