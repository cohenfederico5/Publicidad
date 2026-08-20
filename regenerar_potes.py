"""
Regenera las imagenes de los potes en la web y en los 4 impresos a partir de los
masters retocados (ver retoque.py).

  - Normaliza el par por DIAMETRO DE BASE, no por altura: carne muestra un poco mas
    de tapa porque la camara estaba mas alta, y eso es correcto. Lo que tiene que
    coincidir es el cuerpo.
  - Web: lienzo 1200x1200, linea de base comun, sombra de apoyo horneada.
  - Impresos: SIN sombra horneada (ya aplican drop-shadow por CSS) y respetando el
    lienzo y la linea de base que ya tenia cada archivo, para no correr los layouts.

    python regenerar_potes.py            -> solo informa (dry run)
    python regenerar_potes.py --escribir -> aplica
"""
import base64, glob, io, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SABORES = ("carne", "pollo")
MASTER = "Recursos/pote {} (master retocado).png"
CAN, MARGEN, DIAM_OBJ = 1200, 76, 790.0

POTE = {s: Image.open(MASTER.format(s)).convert("RGBA") for s in SABORES}

def medidas(im):
    """diametro del cuerpo justo sobre la curva de la base, centro y fila de apoyo"""
    a = np.array(im)[:, :, 3]; H = a.shape[0]
    base = max(y for y in range(H) if (a[y] > 60).any())
    ws = []
    for fr in (.10, .14, .18):
        r = np.where(a[base - int(H * fr)] > 60)[0]
        ws.append(r.max() - r.min() + 1)
    ys, xs = np.where(a > 60)
    return float(np.mean(ws)), (xs.min() + xs.max()) / 2.0, base

MED = {s: medidas(POTE[s]) for s in SABORES}
# factor que empareja el par: mismo diametro de base rendereado
REL = {s: MED["carne"][0] / MED[s][0] for s in SABORES}

def bbox(im):
    a = np.array(im)[:, :, 3]; ys, xs = np.where(a > 25)
    return xs.min(), xs.max(), ys.min(), ys.max()

def escalado(sabor, k):
    p = POTE[sabor]
    return p.resize((max(1, round(p.width * k)), max(1, round(p.height * k))), Image.LANCZOS)

# ---------- web ----------

def construir_web(sabor):
    d, cx, base = MED[sabor]
    k = DIAM_OBJ / d
    r = escalado(sabor, k)
    lienzo = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    cy = CAN - MARGEN - 1
    # sombra en dos capas: caida ancha + nucleo de contacto, corrida hacia la
    # derecha porque la luz del relight entra por la izquierda
    som = Image.new("L", (CAN, CAN), 0)
    dr = ImageDraw.Draw(som)
    off = int(DIAM_OBJ * .05)
    rx, ry = int(DIAM_OBJ * .62), int(DIAM_OBJ * .105)
    dr.ellipse([CAN // 2 - rx + off, cy - ry, CAN // 2 + rx + off, cy + ry], fill=58)
    som = som.filter(ImageFilter.GaussianBlur(34))
    nucleo = Image.new("L", (CAN, CAN), 0)
    rx2, ry2 = int(DIAM_OBJ * .47), int(DIAM_OBJ * .045)
    ImageDraw.Draw(nucleo).ellipse(
        [CAN // 2 - rx2 + off // 2, cy - ry2, CAN // 2 + rx2 + off // 2, cy + ry2], fill=120)
    nucleo = nucleo.filter(ImageFilter.GaussianBlur(11))
    som = Image.fromarray(np.maximum(np.array(som), np.array(nucleo)))
    lienzo = Image.composite(Image.new("RGBA", (CAN, CAN), (74, 44, 22, 255)), lienzo, som)
    lienzo.alpha_composite(r, (round(CAN / 2 - cx * k), round(cy - base * k)))
    return lienzo

# ---------- impresos ----------

IMG_RE = re.compile(r'<img\b[^>]*?src="data:image/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)"[^>]*>', re.S)

def clasificar(tag, antes):
    # ojo: la cadena "logo" puede aparecer DENTRO del blob base64
    t = re.sub(r'base64,[A-Za-z0-9+/=]+', 'base64,', tag).lower()
    a = antes.lower()
    if "logo" in t or "logo-circle" in a[-160:] or "brand-block" in a[-260:]:
        return None
    m = re.search(r'alt="([^"]*)"', t)
    if m:
        if "carne" in m.group(1): return "carne"
        if "pollo" in m.group(1): return "pollo"
    pc, pp = a.rfind("carne"), a.rfind("pollo")   # solo el contexto ANTERIOR
    if max(pc, pp) < 0: return None
    return "carne" if pc > pp else "pollo"

def construir_impreso(sabor, W, H, h_ref, base, tight):
    k = (h_ref / POTE["carne"].height) * REL[sabor]
    r = escalado(sabor, k)
    if tight:
        return r
    l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    l.alpha_composite(r, (round(W / 2 - r.width / 2), H - base - r.height))
    return l

def procesar_impresos(escribir):
    for f in sorted(glob.glob("Impresos/*.html")):
        s = open(f, encoding="utf-8", errors="surrogateescape").read()
        items = []
        for m in IMG_RE.finditer(s):
            try:
                im = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGBA")
            except Exception:
                continue
            items.append((m, im, clasificar(m.group(0), s[max(0, m.start() - 400):m.start()])))
        ref = None
        for m, im, sb in items:
            if sb == "carne":
                x0, x1, y0, y1 = bbox(im); ref = y1 - y0 + 1
        print(f"\n{f}")
        nuevos = {}
        for m, im, sb in items:
            if not sb:
                print(f"   - {im.size[0]}x{im.size[1]}  logo, se deja"); continue
            W, H = im.size; x0, x1, y0, y1 = bbox(im)
            tight = (y1 - y0 + 1) >= H - 4 and (x1 - x0 + 1) >= W - 4
            ng = construir_impreso(sb, W, H, ref, H - 1 - y1, tight)
            nb = bbox(ng)
            print(f"   - {W}x{H} {sb:6s} -> {ng.width}x{ng.height} "
                  f"pote {nb[1]-nb[0]+1}x{nb[3]-nb[2]+1}")
            if escribir:
                b = io.BytesIO(); ng.save(b, "PNG", optimize=True)
                nuevos[m.start(1)] = (m, base64.b64encode(b.getvalue()).decode())
        if escribir and nuevos:
            out = []; prev = 0
            for k in sorted(nuevos):
                m, b64 = nuevos[k]
                out.append(s[prev:m.start(1)]); out.append(b64); prev = m.end(1)
            out.append(s[prev:])
            open(f, "w", encoding="utf-8", errors="surrogateescape").write("".join(out))
            print(f"   escrito ({len(nuevos)} potes)")

if __name__ == "__main__":
    escribir = "--escribir" in sys.argv
    print("emparejado del par:", {s: round(v, 4) for s, v in REL.items()})
    for s in SABORES:
        im = construir_web(s)
        a = np.array(im)[:, :, 3]; ys, xs = np.where(a > 140)
        print(f"web {s}: pote {xs.max()-xs.min()+1}x{ys.max()-ys.min()+1} "
              f"centro={(xs.min()+xs.max())//2} base={CAN-1-ys.max()}")
        if escribir:
            im.save(f"pote {s} (web).png")
            im.save(f"Recursos/pote {s} (web).png")
    procesar_impresos(escribir)
    if not escribir:
        print("\n(dry run — pasar --escribir para aplicar)")
