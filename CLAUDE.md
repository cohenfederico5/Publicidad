# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing materials for **Fresquito's** — a premium dog ice cream brand ("Helado Premium Para Perros") based in Argentina. The brand sells two flavors: **Carne** (beef) and **Pollo** (chicken), vet-backed, SENASA-approved (producto inscripto + establecimiento habilitado Est. Nº 2025-96/A/H).

## Folder structure

Reorganizada el 14/08/2026. La raíz tiene solo la web y la configuración; todo lo demás va por tema.

| Ubicación | Qué hay |
|-----------|---------|
| **raíz** | La web: `index.html` (landing), `admin.html` (panel), `privacidad.html`, `Code.gs` (backend Apps Script) + las 5 imágenes que index.html referencia por ruta relativa |
| `Impresos/` | Materiales para imprimir: folletos (comercios, pet friendly) y ploteos de freezer (tapa 45×43,5 · frente 45×62) |
| `Comercial/` | Venta y prospección: propuesta B2B, one-pager y checklist de agencia, restaurantes red Wana, contactos |
| `Estrategia/` | Planes y guías: estrategia de redes, paid media, calendario de pre-lanzamiento, guías, `.docx` de referencia |
| `Amarula/` | Todo lo de la AI influencer: dataset del LoRA, plan, URL del modelo |
| `Recursos/` | Material fuente: **rótulos originales de Carne y Pollo (PDF)**, fotos de producto, logos, fuentes tipográficas, reel |
| `Archivo/` | Cosas viejas que ya no se usan pero no se borran (teasers, sabor vainilla, deploy viejo) |
| `backup/` | Versiones anteriores de archivos que siguen vivos |

⚠️ **No mover** las 5 imágenes de la raíz — `index.html` las referencia por nombre y se rompe la web local:

```
logo_sin_fondo.png
perro caniche lamiendo helado 3.png
perro lamiendo helado 2.png
pote carne (web).png
pote pollo (web).png
```

El resto de los HTML son autocontenidos (imágenes en base64) y se pueden mover libremente.

**Fotos del producto (actualizado 16/08/2026).** Los potes de la web y de los 4 impresos salen de la misma tanda: `Recursos/fotos potes/`. Los masters procesados —enderezados, con la tapa balanceada a neutro y el par normalizado por diámetro del cuerpo— están en `Recursos/pote {carne,pollo} (master alta).png`; de ahí se regenera cualquier variante. Los renders 3D viejos (tapa kraft marrón, que **no existe** en el producto real) y las versiones del 12/08 quedaron en `Archivo/reemplazados 16-08-2026/`.

## Brand Design System

All HTML files share a consistent visual identity — use these values when editing:

**Colors** (tomados del logo oficial):
```css
--red: #C85C4A;        /* primary accent — terracota vintage del logo */
--red-dark: #A8443A;
--cream: #F0E6C0;      /* background — crema del anillo del logo */
--cream-dark: #E0D4A0;
--yellow: #D4A840;     /* highlights, borders — dorado del logo */
--yellow-light: #E0BF60;
--brown: #3D1F0A;      /* dark backgrounds, nav — marrón oscuro cálido */
--brown-mid: #6B3A1F;
--white: #FDFAF2;
--text: #2C1505;
```

**Fonts (Google Fonts):**
- `Playfair Display` — brand name, headings (italic, bold/900)
- `Oswald` — labels, tags, uppercase UI elements
- `Lora` — body text

**Tone:** Warm, premium, emotionally resonant. Spanish (Argentina). Target: dog owners who treat their pets as family members.

## Social / Contact

- Instagram / TikTok / Facebook: `@fresquitos.petfood`
- Email: `infofresquitos@gmail.com`

## Working with the HTML Files

Open directly in a browser — no build step required. Los folletos y ploteos de `Impresos/` están optimizados para impresión: `Ctrl+P` → Guardar como PDF genera el archivo a escala 1:1 para la gráfica.

Los ploteos de freezer usan medidas reales en cm/mm con `@page { size: ... }`, así que el PDF sale al tamaño físico exacto. Las imágenes van embebidas en base64 para que el archivo sea portable.
