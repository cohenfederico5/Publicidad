/**
 * agregar_logo.mjs — Logo overlay automático para contenido de Amarula
 *
 * Uso:
 *   node agregar_logo.mjs <archivo_entrada> [modo]
 *
 * Modos:
 *   bandana    (default) — logo sobre el cuello/bandana, shots estándar
 *   watermark  — logo pequeño en esquina inferior izquierda (close-ups, cenital)
 *
 * Ejemplos:
 *   node agregar_logo.mjs "AI influencer/amarula_reel.mp4"
 *   node agregar_logo.mjs "AI influencer/amarula_closeup.jpg" watermark
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const LOGO = "logo_sin_fondo.png";

const input = process.argv[2];
const modo = process.argv[3] ?? "bandana";

if (!input) {
  console.error("Uso: node agregar_logo.mjs <archivo> [bandana|watermark]");
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error(`Archivo no encontrado: ${input}`);
  process.exit(1);
}

if (!fs.existsSync(LOGO)) {
  console.error(`Logo no encontrado: ${LOGO}`);
  process.exit(1);
}

// Detectar dimensiones del archivo de entrada
const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${input}"`;
const dims = execSync(probeCmd).toString().trim().split(",");
const W = parseInt(dims[0]);
const H = parseInt(dims[1]);
const isVideo = /\.(mp4|mov|webm|avi)$/i.test(input);
const ratio = H / W;
const is916 = ratio > 1.5;

console.log(`📁 Entrada: ${input}`);
console.log(`📐 Dimensiones: ${W}x${H} (${is916 ? "9:16 vertical" : "1:1 cuadrado"})`);
console.log(`🎬 Tipo: ${isVideo ? "video" : "imagen"}`);
console.log(`🏷️  Modo: ${modo}\n`);

// Calcular tamaño y posición del logo
let logoW, logoX, logoY;

if (modo === "watermark") {
  // Esquina inferior izquierda — para close-ups y shots donde la bandana no es visible
  logoW = Math.round(W * 0.20);
  logoX = Math.round(W * 0.04);
  logoY = Math.round(H * 0.88);
} else {
  // Posición calibrada para la bandana — área del cuello, centrado
  logoW = Math.round(W * 0.18);
  logoX = Math.round(W / 2 - logoW / 2);
  if (is916) {
    // 9:16: la bandana en shot medio está aprox al 38% de la altura
    logoY = Math.round(H * 0.38);
  } else {
    // 1:1: la bandana en shot medio está aprox al 57% de la altura
    logoY = Math.round(H * 0.57);
  }
}

// Construir nombre de salida
const ext = path.extname(input);
const base = input.replace(ext, "");
const output = `${base}_con_logo${ext}`;

// Comando ffmpeg
const overlayFilter = `[1:v]scale=${logoW}:-1[logo];[0:v][logo]overlay=${logoX}:${logoY}`;

let cmd;
if (isVideo) {
  cmd = `ffmpeg -i "${input}" -i "${LOGO}" -filter_complex "${overlayFilter}" -codec:a copy -y "${output}"`;
} else {
  cmd = `ffmpeg -i "${input}" -i "${LOGO}" -filter_complex "${overlayFilter}" -y "${output}"`;
}

console.log("⚙️  Aplicando logo...");
try {
  execSync(cmd, { stdio: "pipe" });
  console.log(`✅ Listo: ${output}`);
  console.log(`\n💡 Si el logo no quedó exactamente sobre la bandana, usá modo watermark:`);
  console.log(`   node agregar_logo.mjs "${input}" watermark`);
} catch (e) {
  console.error("Error en ffmpeg:", e.stderr?.toString() ?? e.message);
  process.exit(1);
}
