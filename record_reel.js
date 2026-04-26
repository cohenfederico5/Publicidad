const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORK_DIR = path.resolve('c:/Documents/Scoop Dog/Publicidad');
const REC_DIR  = path.join(WORK_DIR, 'recordings');
const AUDIO_FILE  = path.join(REC_DIR, 'paw_audio.wav');
const OUTPUT_FILE = path.join(WORK_DIR, 'reel_instagram_final.mp4');

const SPACE_DELAY_MS  = 2000;   // espera antes de presionar espacio
const ANIM_DURATION_MS = 12000; // duración de la animación

const pataDelays = [0.15, 0.4, 0.65, 0.9, 1.15, 1.4, 1.65, 1.9, 2.15, 2.4, 2.65];

function generateWav(filename, spaceTimeSec) {
  const sampleRate  = 44100;
  const totalSec    = (SPACE_DELAY_MS + ANIM_DURATION_MS + 1500) / 1000;
  const totalSamples = Math.ceil(totalSec * sampleRate);
  const buf = Buffer.alloc(44 + totalSamples * 2);

  // WAV header — mono 16-bit PCM
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + totalSamples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);  // PCM
  buf.writeUInt16LE(1, 22);  // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(totalSamples * 2, 40);

  const samples = new Float32Array(totalSamples);

  // Bandpass filter coefficients — 750 Hz, Q=2.2
  const fc = 750 / sampleRate;
  const Q  = 2.2;
  const w0 = 2 * Math.PI * fc;
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 =  alpha, b2 = -alpha;
  const a0 =  1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;

  pataDelays.forEach(delay => {
    const startSample = Math.floor((spaceTimeSec + delay) * sampleRate);
    const envDuration = Math.floor(0.12 * sampleRate);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < envDuration; i++) {
      const t   = i / sampleRate;
      const env = Math.exp(-t / 0.018) * 0.38;

      // Filtered noise (bandpass)
      const noise = Math.random() * 2 - 1;
      const y = (b0/a0)*noise + (b2/a0)*x2 - (a1/a0)*y1 - (a2/a0)*y2;
      x2 = x1; x1 = noise; y2 = y1; y1 = y;

      // Sub-grave sweep 55 → 24 Hz
      const freq = 55 * Math.pow(24 / 55, Math.min(t / 0.09, 1));
      const sub  = Math.sin(2 * Math.PI * freq * t) * 0.18 * Math.exp(-t / 0.03);

      const s = startSample + i;
      if (s < totalSamples) samples[s] += y * env + sub;
    }
  });

  // Normalizar
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const scale = peak > 0.85 ? 0.85 / peak : 1;

  for (let i = 0; i < totalSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i] * scale));
    buf.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filename, buf);
  console.log('Audio generado:', filename);
}

async function main() {
  if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR);

  generateWav(AUDIO_FILE, SPACE_DELAY_MS / 1000);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 607, height: 1080 },
    recordVideo: { dir: REC_DIR, size: { width: 607, height: 1080 } }
  });

  const page = await context.newPage();
  const fileUrl = 'file:///C:/Documents/Scoop%20Dog/Publicidad/reel_lanzamiento.html';
  await page.goto(fileUrl);
  await page.waitForTimeout(SPACE_DELAY_MS);
  await page.keyboard.press('Space');
  console.log('Animacion iniciada...');
  await page.waitForTimeout(ANIM_DURATION_MS + 1000);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  console.log('Video grabado:', videoPath);

  if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

  // Escalar a 1080x1920 (Instagram Reels) y mezclar audio
  const cmd = `ffmpeg -i "${videoPath}" -i "${AUDIO_FILE}" `
    + `-vf scale=1080:1920 `
    + `-c:v libx264 -preset fast -crf 20 `
    + `-c:a aac -b:a 128k `
    + `-shortest -y "${OUTPUT_FILE}"`;

  console.log('Mezclando video + audio y escalando a 1080x1920...');
  execSync(cmd, { stdio: 'inherit' });

  fs.unlinkSync(videoPath);
  fs.unlinkSync(AUDIO_FILE);

  console.log('\nListo:', OUTPUT_FILE);
}

main().catch(err => { console.error(err); process.exit(1); });
