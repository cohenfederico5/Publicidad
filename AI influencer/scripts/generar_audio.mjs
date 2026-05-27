/**
 * generar_audio.mjs — Voz de Amarula para Fresquito's
 *
 * Uso:
 *   node generar_audio.mjs "Che, soy Amarula. Y tengo mucho para decirles."
 *   node generar_audio.mjs "texto" nombre_archivo
 *
 * El audio se guarda en AI influencer/ como .mp3
 */

import fs from "fs";

const XI_KEY = "sk_62ce3617ee5154bd4f157957c44adfdadf26ce0f6ab31ca2";
const VOICE_ID = "r3INp2oTH8AzVhAH5ZrZ";

const texto = process.argv[2];
const nombre = process.argv[3] ?? `amarula_audio_${Date.now()}`;

if (!texto) {
  console.error('Uso: node generar_audio.mjs "el texto que va a decir Amarula"');
  process.exit(1);
}

console.log(`🎙️ Generando voz de Amarula...`);
console.log(`   "${texto.slice(0, 60)}${texto.length > 60 ? "..." : ""}"\n`);

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  method: "POST",
  headers: {
    "xi-api-key": XI_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: texto,
    model_id: "eleven_multilingual_v2",
    speed: 0.85,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true,
    },
  }),
});

if (!res.ok) {
  console.error("Error:", await res.text());
  process.exit(1);
}

const output = `AI influencer/${nombre}.mp3`;
fs.writeFileSync(output, Buffer.from(await res.arrayBuffer()));
console.log(`✅ Listo: ${output}`);
