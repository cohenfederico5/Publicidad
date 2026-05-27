/**
 * armar_reel.mjs — Ensambla el Reel final: video + audio + subtítulos + logo
 * Uso: node armar_reel.mjs <video.mp4> <audio.mp3> <"linea1|linea2|linea3"> <salida.mp4>
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const video  = process.argv[2];
const audio  = process.argv[3];
const textos = (process.argv[4] ?? "").split("|");
const salida = process.argv[5] ?? `AI influencer/reel_final_${Date.now()}.mp4`;
const LOGO   = "logo_sin_fondo.png";

if (!video || !audio) {
  console.error("Uso: node armar_reel.mjs video.mp4 audio.mp3 'linea1|linea2|linea3' salida.mp4");
  process.exit(1);
}

// Duración del audio (fuente de verdad para la duración del Reel)
const audioDur = parseFloat(
  execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audio}"`).toString().trim()
);
console.log(`⏱️  Duración audio: ${audioDur.toFixed(2)}s`);

// Crear archivo de subtítulos ASS (TikTok style: blanco, centrado, borde negro)
const totalLines = textos.length;
const secPerLine = audioDur / totalLines;

function toASS(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t % 1) * 100);
  return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}

const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV
Style: Amarula,Arial,56,&H00FFFFFF,&H00000000,&H00000000,-1,0,1,3,0,2,40,40,120

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

const assEvents = textos.map((line, i) => {
  const start = i * secPerLine;
  const end   = (i + 1) * secPerLine;
  return `Dialogue: 0,${toASS(start)},${toASS(end)},Amarula,,0,0,0,,{\\an2}${line}`;
}).join("\n");

const assPath = "subs_temp.ass";
fs.writeFileSync(assPath, assHeader + assEvents, "utf8");

// Tamaño logo watermark
const logoW = 130;
const logoX = 20;
const logoY = 1280 - 130 - 20;

// ffmpeg: extender video, agregar audio, subtítulos y logo
const filter = `[0:v]tpad=stop_mode=clone:stop_duration=3[vext];[2:v]scale=${logoW}:-1[logo];[vext][logo]overlay=${logoX}:${logoY}[vlogo];[vlogo]ass='${assPath}'[vfinal]`;

const cmd = `ffmpeg -i "${video}" -i "${audio}" -i "${LOGO}" -filter_complex "${filter}" -map [vfinal] -map 1:a -t ${audioDur + 0.2} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -y "${salida}"`;

console.log("🎬 Ensamblando Reel...");
try {
  execSync(cmd, { stdio: "pipe" });
  console.log(`✅ Reel listo: ${salida}`);
} catch(e) {
  console.error("Error ffmpeg:", e.stderr?.toString()?.slice(-500));
  process.exit(1);
}

// Limpiar temp
if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
