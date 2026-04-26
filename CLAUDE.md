# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing materials for **Fresquito's** — a premium dog ice cream brand ("Helado Premium Para Perros") based in Argentina. The brand sells two flavors: **Carne** (beef) and **Pollo** (chicken), vet-backed, SENASA-approved (producto inscripto + establecimiento habilitado Est. Nº 2025-96/A/H).

## Files

| File | Purpose |
|------|---------|
| `fresquitos.html` | Main landing page / website |
| `Folleto fresquitos.html` | Print-ready A4 flyer (210mm × 297mm) |
| `Propuesta Fresquito's - Retriever.pdf` | Agency proposal from Retriever |
| `Gestion redes sociales (prompts claude).docx` | Claude prompts for social media management |
| `estrategia_fresquitos.docx` | Marketing strategy document |

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

Open directly in a browser — no build step required. The flyer (`Folleto fresquitos.html`) is print-optimized; use browser print (`Ctrl+P`) or `@media print` styles to generate PDFs.

Product images are referenced via local upload paths (`/mnt/user-data/uploads/...`); replace with actual hosted URLs when deploying.
