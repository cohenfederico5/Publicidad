import { fal } from "@fal-ai/client";
import { execSync } from "child_process";
import fs from "fs";

const FAL_KEY = "8e8f8e7e-75b3-43c0-a442-485dc1706183:78d0551b8667443d26def2028074c5ff";
const LORA_URL = "https://v3b.fal.media/files/b/0a996f00/nL2oZatyBNcwC3zW4QvbP_pytorch_lora_weights.safetensors";

fal.config({ credentials: FAL_KEY });

const prompt = process.argv[2];
const nombre = process.argv[3] ?? `amarula_${Date.now()}`;
const size = process.argv[4] ?? "square_hd";

if (!prompt) {
  console.error('Uso: node generar_imagen.mjs "prompt" nombre_archivo [square_hd|portrait_16_9]');
  process.exit(1);
}

console.log(`🐾 Generando imagen de Amarula...`);

// Anclar siempre el contexto canino para que Flux no genere humanos
const anchoredPrompt = prompt.startsWith("AMRL white swiss shepherd dog")
  ? prompt
  : `AMRL white swiss shepherd dog, fluffy white fur, ${prompt}`;

const result = await fal.subscribe("fal-ai/flux-lora", {
  input: {
    prompt: anchoredPrompt,
    negative_prompt: "logo, watermark, badge, emblem, circular emblem, brand logo, text overlay, stamp, seal, corner logo, fresquitos logo",
    loras: [{ path: LORA_URL, scale: 0.9 }],
    image_size: size,
    num_images: 1,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  },
});

const url = result.data.images[0].url;
const buffer = await fetch(url).then(r => r.arrayBuffer());
const raw = `AI influencer/${nombre}_raw.jpg`;
const output = `AI influencer/${nombre}.jpg`;
fs.writeFileSync(raw, Buffer.from(buffer));

// Crop bottom 224px para eliminar logo que el LoRA genera en la esquina inferior
execSync(`ffmpeg -i "${raw}" -vf "crop=1024:800:0:0" -update 1 -y "${output}"`, { stdio: "pipe" });
fs.unlinkSync(raw);
console.log(`✅ Guardada: ${output}`);
