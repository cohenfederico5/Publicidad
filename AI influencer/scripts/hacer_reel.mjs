/**
 * hacer_reel.mjs — Pipeline completo de Amarula
 * Uso: node hacer_reel.mjs "descripción visual" "texto que dice Amarula" nombre_salida ["sub1|sub2|sub3"]
 *
 * Pipeline: imagen (Flux LoRA) → audio (ElevenLabs) → OmniHuman (lip sync) → logo + subs → MP4
 */

import { fal } from "@fal-ai/client";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// ── Assets fijos — nunca cambiar ─────────────────────────────────────────────
const FAL_KEY  = "8e8f8e7e-75b3-43c0-a442-485dc1706183:78d0551b8667443d26def2028074c5ff";
const LORA_URL = "https://v3b.fal.media/files/b/0a996f00/nL2oZatyBNcwC3zW4QvbP_pytorch_lora_weights.safetensors";
const VOICE_ID = "r3INp2oTH8AzVhAH5ZrZ";
const XI_KEY   = "sk_62ce3617ee5154bd4f157957c44adfdadf26ce0f6ab31ca2";
const LOGO     = "logo_sin_fondo.png";
const CARPETA  = "AI influencer";

fal.config({ credentials: FAL_KEY });

// ── Args ──────────────────────────────────────────────────────────────────────
const descripcion  = process.argv[2];
const textoAmarula = process.argv[3];
const nombre       = process.argv[4] ?? `reel_${Date.now()}`;
const subsArg      = process.argv[5];

if (!descripcion || !textoAmarula) {
  console.error('Uso: node hacer_reel.mjs "descripción visual" "texto que dice Amarula" nombre_salida ["sub1|sub2|sub3"]');
  process.exit(1);
}

function dividirEnSubs(texto, porLinea = 6) {
  const palabras = texto.split(" ");
  const chunks = [];
  for (let i = 0; i < palabras.length; i += porLinea)
    chunks.push(palabras.slice(i, i + porLinea).join(" "));
  return chunks;
}

const subtitulos = subsArg ? subsArg.split("|") : dividirEnSubs(textoAmarula);

if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA);

const imgPath   = `${CARPETA}/${nombre}_img.jpg`;
const audioPath = `${CARPETA}/${nombre}_audio.mp3`;
const videoPath = `${CARPETA}/${nombre}_video.mp4`;
const reelPath  = `${CARPETA}/${nombre}_reel.mp4`;

console.log(`\n┌─────────────────────────────────────────────┐`);
console.log(`│  🐾  AMARULA REEL PIPELINE                  │`);
console.log(`└─────────────────────────────────────────────┘`);
console.log(`\n📋 Concepto: ${descripcion}`);
console.log(`💬 Texto:    ${textoAmarula}`);
console.log(`📁 Salida:   ${reelPath}\n`);

// ── 1. Generar imagen ─────────────────────────────────────────────────────────
console.log(`[1/4] 🖼️  Generando imagen con Flux LoRA...`);

const promptImagen = `AMRL white swiss shepherd dog, fluffy white fur, medium shot showing full head neck and chest, ${descripcion}, plain solid crimson red triangular scarf tied around neck, bandana clearly visible on neck, looking directly at camera, animal photography, photorealistic`;

const imgResult = await fal.subscribe("fal-ai/flux-lora", {
  input: {
    prompt: promptImagen,
    loras: [{ path: LORA_URL, scale: 0.9 }],
    image_size: "portrait_16_9",
    num_images: 1,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  },
});

const imgUrl = imgResult.data.images[0].url;
fs.writeFileSync(imgPath, Buffer.from(await fetch(imgUrl).then(r => r.arrayBuffer())));
console.log(`     ✅ ${imgPath}`);

// ── 2. Generar audio ──────────────────────────────────────────────────────────
console.log(`\n[2/4] 🎙️  Generando voz de Amarula...`);

const audioRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  method: "POST",
  headers: { "xi-api-key": XI_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    text: textoAmarula,
    model_id: "eleven_multilingual_v2",
    speed: 0.85,
    voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
  }),
});

if (!audioRes.ok) { console.error("❌ Error ElevenLabs:", await audioRes.text()); process.exit(1); }
fs.writeFileSync(audioPath, Buffer.from(await audioRes.arrayBuffer()));
console.log(`     ✅ ${audioPath}`);

// ── 3. OmniHuman — imagen + audio → video con lip sync ───────────────────────
console.log(`\n[3/4] 🎬 Animando con OmniHuman (lip sync)...`);

const [imageUrlFal, audioUrlFal] = await Promise.all([
  fal.storage.upload(new File([fs.readFileSync(imgPath)],   "amarula.jpg", { type: "image/jpeg" })),
  fal.storage.upload(new File([fs.readFileSync(audioPath)], "amarula.mp3", { type: "audio/mpeg" })),
]);

const omniResult = await fal.subscribe("fal-ai/bytedance/omnihuman", {
  input: { image_url: imageUrlFal, audio_url: audioUrlFal },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_QUEUE")    process.stdout.write(`\r   ⏳ En cola...   `);
    if (u.status === "IN_PROGRESS") process.stdout.write(`\r   🔄 Procesando...   `);
  },
});

const omniVideoUrl = omniResult.data?.video?.url || omniResult.data?.url;
if (!omniVideoUrl) { console.error("\n❌ OmniHuman no devolvió video"); process.exit(1); }
fs.writeFileSync(videoPath, Buffer.from(await fetch(omniVideoUrl).then(r => r.arrayBuffer())));
console.log(`\n     ✅ ${videoPath}`);

// ── 4. Ensamblar Reel (logo + subtítulos) ────────────────────────────────────
console.log(`\n[4/4] 🎞️  Ensamblando Reel (logo + subtítulos)...`);

const audioDur = parseFloat(
  execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`).toString().trim()
);
const secPerLine = audioDur / subtitulos.length;

function toASS(t) {
  const h  = Math.floor(t / 3600);
  const m  = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
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

const assEvents = subtitulos.map((line, i) => {
  const start = i * secPerLine;
  const end   = (i + 1) * secPerLine;
  return `Dialogue: 0,${toASS(start)},${toASS(end)},Amarula,,0,0,0,,{\\an2}${line}`;
}).join("\n");

const assPath = path.join(os.tmpdir(), "amarula_subs.ass");
fs.writeFileSync(assPath, assHeader + assEvents, "utf8");
const assPathFfmpeg = assPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `${d}\\:`);

const dimStr = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`).toString().trim();
const [VW, VH] = dimStr.split(",").map(Number);

const logoW = Math.round(VW * 0.14);
const logoX = VW - logoW - 18;
const logoY = VH - logoW - 80;

// OmniHuman ya trae audio — solo necesitamos agregar logo y subs
const filter = `[1:v]scale=${logoW}:-1,format=rgba,colorchannelmixer=aa=0.75[logo];[0:v][logo]overlay=${logoX}:${logoY}[vlogo];[vlogo]ass='${assPathFfmpeg}'[vfinal]`;
const cmd = `ffmpeg -i "${videoPath}" -i "${LOGO}" -filter_complex "${filter}" -map [vfinal] -map 0:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -y "${reelPath}"`;

try {
  execSync(cmd, { stdio: "pipe" });
} catch (e) {
  console.error("❌ Error ffmpeg:", e.stderr?.toString()?.slice(-800));
  process.exit(1);
}

if (fs.existsSync(assPath)) fs.unlinkSync(assPath);

console.log(`\n┌─────────────────────────────────────────────┐`);
console.log(`│  🎉  REEL LISTO                              │`);
console.log(`└─────────────────────────────────────────────┘`);
console.log(`\n   📁 ${reelPath}`);
console.log(`   ⏱️  ${audioDur.toFixed(1)}s`);
console.log(`   🎬 Motor: OmniHuman (ByteDance) — lip sync real`);
console.log(`   📝 Subs: ${subtitulos.join(" / ")}\n`);
