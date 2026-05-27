import { fal } from "@fal-ai/client";
import fs from "fs";

const FAL_KEY = "8e8f8e7e-75b3-43c0-a442-485dc1706183:78d0551b8667443d26def2028074c5ff";
fal.config({ credentials: FAL_KEY });

const imagePath = process.argv[2];
const prompt = process.argv[3];
const nombre = process.argv[4] ?? `amarula_video_${Date.now()}`;

if (!imagePath || !prompt) {
  console.error('Uso: node animar_imagen.mjs "imagen.jpg" "prompt de animacion" nombre_salida');
  process.exit(1);
}

console.log(`🎬 Animando imagen con Veo...`);

// Subir imagen a fal storage
const imageBuffer = fs.readFileSync(imagePath);
const imageFile = new File([imageBuffer], "input.jpg", { type: "image/jpeg" });
const imageUrl = await fal.storage.upload(imageFile);
console.log("✅ Imagen subida");

const result = await fal.subscribe("fal-ai/veo2", {
  input: {
    prompt,
    image_url: imageUrl,
    duration: "5s",
    aspect_ratio: "9:16",
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") process.stdout.write(".");
  },
});

console.log("\n✅ Video generado");
const videoUrl = result.data.video?.url;
const buffer = await fetch(videoUrl).then(r => r.arrayBuffer());
const output = `AI influencer/${nombre}.mp4`;
fs.writeFileSync(output, Buffer.from(buffer));
console.log(`✅ Guardado: ${output}`);
