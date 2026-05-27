import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const tmp = os.tmpdir();
fs.copyFileSync("PlayfairDisplay-Bold.ttf", path.join(tmp, "PlayfairDisplay-Bold.ttf"));
fs.copyFileSync("Oswald-Bold.ttf",          path.join(tmp, "Oswald-Bold.ttf"));

const tf1 = path.join(tmp, "fq1.txt");
const tf2 = path.join(tmp, "fq2.txt");
fs.writeFileSync(tf1, "Fresquito's",               "utf8");
fs.writeFileSync(tf2, "Helado Premium para Perros", "utf8");

const ffpF = (p) => path.resolve(p).replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `${d}\\:`);
const ffpA = (p) => path.resolve(p).replace(/\\/g, "/");

const FONT1 = ffpF(path.join(tmp, "PlayfairDisplay-Bold.ttf"));
const FONT2 = ffpF(path.join(tmp, "Oswald-Bold.ttf"));
const TF1   = ffpF(tf1);
const TF2   = ffpF(tf2);

// dataset_01: 1024x1024, bandana centrada al ~47%
const W = 1024, H = 1024;
const fs1 = 44, fs2 = 26;
const y1 = Math.round(H * 0.455);
const y2 = y1 + fs1 + 6;

const filter = [
  `drawtext=fontfile='${FONT1}':textfile='${TF1}':fontcolor=white:fontsize=${fs1}:x=(w-text_w)/2:y=${y1}:shadowcolor=black@0.5:shadowx=2:shadowy=2`,
  `drawtext=fontfile='${FONT2}':textfile='${TF2}':fontcolor=white:fontsize=${fs2}:x=(w-text_w)/2:y=${y2}:shadowcolor=black@0.5:shadowx=1:shadowy=1`,
].join(",");

execSync(
  `ffmpeg -i "${ffpA("AI influencer/dataset_01_sentada_frontal.jpg")}" -vf "${filter}" -y "${ffpA("AI influencer/preview_label.jpg")}"`,
  { stdio: "pipe" }
);
console.log("✅ AI influencer/preview_label.jpg");
