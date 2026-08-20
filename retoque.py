"""
Retoque de los potes: lleva la foto real al look de estudio de las referencias de IA.
Trata tapa y cuerpo por separado — la tapa es blanca en la realidad pero la luz de
tungsteno la deja beige y con las abolladuras marcadas.

    python retoque.py            -> regenera los masters retocados
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# ---------- geometria ----------

def perfil(al):
    """centro y semiancho por fila, interpolados y suavizados"""
    H, W = al.shape
    cx = np.full(H, np.nan); hw = np.full(H, np.nan)
    for y in range(H):
        xs = np.where(al[y] > 0.5)[0]
        if len(xs) > 8:
            cx[y] = (xs.min() + xs.max()) / 2
            hw[y] = (xs.max() - xs.min()) / 2
    ok = ~np.isnan(cx); idx = np.arange(H)
    cx = np.interp(idx, idx[ok], cx[ok]); hw = np.interp(idx, idx[ok], hw[ok])
    return ndi.uniform_filter1d(cx, 31), ndi.uniform_filter1d(hw, 31)

def inclinacion(al, j):
    """pendiente del eje del cuerpo en px por fila (0 = perfectamente vertical)"""
    H = al.shape[0]
    Y, C = [], []
    for y in range(j + 60, H - int(H * .10), 4):
        xs = np.where(al[y] > 0.5)[0]
        if len(xs) > 50:
            Y.append(y); C.append((xs.min() + xs.max()) / 2)
    if len(Y) < 20: return 0.0, 0.0
    m, _ = np.polyfit(np.asarray(Y, float), np.asarray(C, float), 1)
    return float(m), float(np.mean(Y))

def enderezar(im):
    """
    Corrige la convergencia de las verticales con un shear horizontal.
    Rotar seria incorrecto: dejaria la linea de apoyo en pendiente.
    """
    a = np.asarray(im).astype(float)
    al = a[:, :, 3] / 255.0
    j = union_tapa(al)
    m, y0 = inclinacion(al, j)
    if abs(m) < 1e-4: return im, 0.0
    pad = int(abs(m) * im.height) + 12
    lienzo = Image.new("RGBA", (im.width + 2 * pad, im.height), (0, 0, 0, 0))
    lienzo.paste(im, (pad, 0))
    # salida(x,y) toma de entrada(x + m*(y-y0), y)
    out = lienzo.transform(lienzo.size, Image.AFFINE, (1, m, -m * y0, 0, 1, 0),
                           resample=Image.BICUBIC)
    b = np.asarray(out)[:, :, 3]
    ys, xs = np.where(b > 20)
    return out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), np.degrees(np.arctan(m))

def union_tapa(al):
    """fila donde la tapa se une al cuerpo: mayor caida del ancho en el tercio superior"""
    H = al.shape[0]
    anc = np.array([(al[y] > .5).sum() for y in range(H)], float)
    d = np.diff(ndi.uniform_filter1d(anc, 21))
    return int(np.argmin(d[:int(H * .55)]))

# ---------- bloques ----------

def sombreado(rgb, al, fuerza, luz=(-0.34, 0.94), spec=0.06, exp_spec=26):
    """volumen cilindrico: los bordes bajan, la zona hacia la luz sube"""
    H, W, _ = rgb.shape
    cx, hw = perfil(al)
    u = np.clip((np.arange(W)[None, :] - cx[:, None]) / np.maximum(hw[:, None], 1), -1, 1)
    nz = np.sqrt(np.clip(1 - u * u, 0, 1))
    lx, lz = luz; n = np.hypot(lx, lz); lx, lz = lx / n, lz / n
    d = np.clip(u * lx + nz * lz, 0, 1)
    f = 0.82 + 0.26 * d + spec * (d ** exp_spec)
    return np.clip(rgb * (1 + (f - 1) * fuerza)[..., None], 0, 255)

def neutralizar(rgb, mascara, rb_obj, luma_obj):
    """lleva una region a un R-B objetivo y a una luma objetivo"""
    if mascara.sum() < 50: return rgb
    px = rgb[mascara]
    rb = px[:, 0].mean() - px[:, 2].mean()
    L = (px @ [.299, .587, .114]).mean()
    out = rgb.copy()
    corr = (rb - rb_obj) / 2.0
    out[mascara, 0] -= corr
    out[mascara, 2] += corr
    px2 = out[mascara]
    L2 = (px2 @ [.299, .587, .114]).mean()
    out[mascara] = np.clip(px2 * (luma_obj / max(L2, 1)), 0, 255)
    return out

def alisar(rgb, mascara, radio=3.0, mezcla=0.80):
    """borra abolladuras y ruido en zonas planas, sin tocar el texto"""
    s = np.dstack([ndi.median_filter(rgb[:, :, c], size=5) for c in range(3)])
    b = np.dstack([ndi.gaussian_filter(s[:, :, c], radio) for c in range(3)])
    det = ndi.gaussian_filter(np.abs(rgb - b).mean(2), 3)
    w = np.clip(1 - det / 20.0, 0, 1) * mezcla
    w = w * mascara
    return rgb * (1 - w[..., None]) + b * w[..., None]

def oclusion_bajo_tapa(rgb, al, j, alto=46, prof=0.13):
    """sombrita que proyecta el voladizo de la tapa sobre el cuerpo"""
    H = rgb.shape[0]
    y = np.arange(H)[:, None]
    t = np.clip((y - j) / alto, 0, 1)
    f = 1 - prof * (1 - t) * (y >= j)
    return np.clip(rgb * f[..., None], 0, 255)

def rolloff_altas(rgb, umbral=232.0, techo=252.0):
    """comprime las altas en vez de clipearlas: evita perder el relieve de la tapa"""
    x = rgb / 255.0; u = umbral / 255.0; t = techo / 255.0
    alto = x > u
    x[alto] = u + (t - u) * (1 - np.exp(-(x[alto] - u) / max(t - u, 1e-6)))
    return np.clip(x * 255, 0, 255)

def _mascara_tono(rgb, objetivo, tol=20.0, croma_min=0.055):
    """
    Peso suave por cercania de tono, ignorando el brillo.
    La compuerta de croma evita que el crema del cuerpo — que tambien es calido —
    entre en la mascara del terracota y termine tinendo todo de naranja.
    """
    n = lambda v: v / np.maximum(v.sum(-1, keepdims=True), 1e-6)
    c = n(rgb)
    d = np.linalg.norm(c - n(np.array(objetivo, float)[None, None, :]), axis=-1)
    w = np.clip(1 - d / (tol / 255.0), 0, 1)
    croma = c.max(-1) - c.min(-1)
    return w * np.clip((croma - croma_min) / 0.05, 0, 1)

def acercar_a_marca(rgb, al, fuerza=0.75):
    """
    Lleva el terracota y el amarillo del rotulo a los colores de marca.
    La luz de tungsteno + el balance de blancos los dejan lavados.
    """
    objetivos = [((200., 92., 74.), (185., 120., 92.)),    # --red      (referencia actual)
                 ((212., 168., 64.), (245., 222., 140.))]  # --yellow
    dentro = al > 0.75
    out = rgb.copy()
    for marca, ref in objetivos:
        w = _mascara_tono(rgb, ref) * dentro
        if w.sum() < 200: continue
        actual = np.array([np.average(rgb[:, :, c], weights=w) for c in range(3)])
        gain = np.clip(np.array(marca) / np.maximum(actual, 1), 0.72, 1.35)
        gain = 1 + (gain - 1) * fuerza
        out = out * (1 - w[..., None]) + np.clip(out * gain, 0, 255) * w[..., None]
    return np.clip(out, 0, 255)

def claridad(rgb, mascara, radio=14.0, cantidad=0.30):
    """contraste local: le da cuerpo al rotulo sin tocar el balance general"""
    b = np.dstack([ndi.gaussian_filter(rgb[:, :, c], radio) for c in range(3)])
    d = (rgb - b) * cantidad * mascara[..., None]
    return np.clip(rgb + d, 0, 255)

def nitidez(rgb, radio=1.6, cantidad=0.60):
    b = np.dstack([ndi.gaussian_filter(rgb[:, :, c], radio) for c in range(3)])
    return np.clip(rgb + (rgb - b) * cantidad, 0, 255)

def grade(rgb, sat=1.07, contraste=1.05, brillo=1.03):
    g = (rgb @ [.299, .587, .114])[..., None]
    out = (g + (rgb - g) * sat) * brillo
    x = np.clip(out / 255, 0, 1)
    return np.clip((np.clip((x - .5) * contraste + .5, 0, 1)) * 255, 0, 255)

# ---------- pipeline ----------

def procesar(entrada, salida):
    im = Image.open(entrada).convert("RGBA")
    im, ang = enderezar(im)          # 0. verticales a plomo
    a = np.asarray(im).astype(float)
    rgb, al = a[:, :, :3].copy(), a[:, :, 3] / 255.0
    m = al > 0.5
    j = union_tapa(al)
    tapa = m.copy();   tapa[j:] = False
    cuerpo = m.copy(); cuerpo[:j] = False

    # 1. la tapa blanca vuelve a ser blanca, y sin abolladuras
    rgb = neutralizar(rgb, tapa, rb_obj=7.0, luma_obj=221.0)
    rgb = alisar(rgb, tapa.astype(float), radio=4.0, mezcla=0.88)
    # 2. el cuerpo levanta un poco y se limpia el ruido
    rgb = neutralizar(rgb, cuerpo, rb_obj=52.0, luma_obj=178.0)
    rgb = alisar(rgb, cuerpo.astype(float), radio=2.2, mezcla=0.60)
    # 3. volumen: la tapa mas suave que el cuerpo
    tap3 = np.dstack([tapa] * 3); cue3 = np.dstack([cuerpo] * 3)
    rgb = np.where(tap3, sombreado(rgb, al, fuerza=0.55, spec=0.05), rgb)
    rgb = np.where(cue3, sombreado(rgb, al, fuerza=0.85, spec=0.07), rgb)
    # 4. color de marca y cuerpo del rotulo
    rgb = acercar_a_marca(rgb, al)
    rgb = claridad(rgb, cuerpo.astype(float))
    # 5. remate
    rgb = oclusion_bajo_tapa(rgb, al, j)
    rgb = grade(rgb)
    rgb = nitidez(rgb)
    rgb = rolloff_altas(rgb)   # ultimo: el enfoque vuelve a empujar por encima de 255

    Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), "RGBA").save(salida)
    return j, ang

if __name__ == "__main__":
    for s in ("carne", "pollo"):
        j, ang = procesar(f"Recursos/pote {s} (master alta).png",
                          f"Recursos/pote {s} (master retocado).png")
        print(f"{s}: enderezado {ang:+.2f}deg | union tapa/cuerpo y={j}")
