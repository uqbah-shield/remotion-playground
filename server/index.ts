import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, type Codec } from "@remotion/renderer";
import { even } from "../src/sizes";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out");
const PORT = Number(process.env.PORT ?? 3001);
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE || null;
fs.mkdirSync(OUT_DIR, { recursive: true });

type Format = "mp4" | "webm" | "mov";
const FORMATS: Record<Format, { codec: Codec; ext: string; mime: string }> = {
  mp4: { codec: "h264", ext: "mp4", mime: "video/mp4" },
  webm: { codec: "vp9", ext: "webm", mime: "video/webm" },
  mov: { codec: "prores", ext: "mov", mime: "video/quicktime" },
};

type Job = {
  id: string;
  status: "queued" | "bundling" | "rendering" | "done" | "error";
  progress: number;
  format: Format;
  file?: string;
  error?: string;
  createdAt: number;
};
const jobs = new Map<string, Job>();

// Bundle komposisi "Runner" sekali saja; kode pengguna dikirim lewat inputProps.
let serveUrlPromise: Promise<string> | null = null;
const getServeUrl = () =>
  (serveUrlPromise ??= bundle({
    entryPoint: path.join(ROOT, "src/remotion/index.ts"),
    onProgress: (p) => p % 25 === 0 && console.log(`[bundle] ${p}%`),
  }).catch((e) => {
    serveUrlPromise = null;
    throw e;
  }));

// Render satu per satu (render memakan CPU besar).
let chain: Promise<void> = Promise.resolve();

async function runJob(job: Job, body: any) {
  const f = FORMATS[job.format];
  job.status = "bundling";
  const serveUrl = await getServeUrl();

  const transparent = Boolean(body.transparent) && job.format !== "mp4";
  const inputProps = {
    code: String(body.code),
    layout: body.layout ?? "responsive",
    designWidth: even(body.designWidth),
    designHeight: even(body.designHeight),
    width: even(body.width),
    height: even(body.height),
    fps: Number(body.fps) || 30,
    durationInFrames: Math.max(1, Math.round(Number(body.durationInFrames) || 150)),
    transparent,
  };

  job.status = "rendering";
  const composition = await selectComposition({
    serveUrl,
    id: "Runner",
    inputProps,
    browserExecutable: BROWSER,
  });

  const file = path.join(OUT_DIR, `${job.id}.${f.ext}`);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: f.codec,
    outputLocation: file,
    browserExecutable: BROWSER,
    ...(job.format === "mov" ? { proResProfile: transparent ? "4444" : "hq" } : {}),
    ...(transparent
      ? { imageFormat: "png" as const, pixelFormat: job.format === "mov" ? ("yuva444p10le" as const) : ("yuva420p" as const) }
      : {}),
    onProgress: ({ progress }) => {
      job.progress = progress;
    },
  });
  job.file = file;
  job.progress = 1;
  job.status = "done";
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/api/render", (req, res) => {
  const body = req.body ?? {};
  if (typeof body.code !== "string" || !body.code.trim()) return res.status(400).json({ error: "Kode kosong" });
  if (!(body.format in FORMATS)) return res.status(400).json({ error: "Format harus mp4, webm, atau mov" });
  for (const k of ["width", "height", "designWidth", "designHeight"]) {
    const v = Number(body[k]);
    if (!(v >= 16 && v <= 4096)) return res.status(400).json({ error: `${k} harus 16–4096` });
  }

  const job: Job = { id: crypto.randomUUID(), status: "queued", progress: 0, format: body.format, createdAt: Date.now() };
  jobs.set(job.id, job);
  chain = chain.then(() =>
    runJob(job, body).catch((e) => {
      console.error(`[render ${job.id}]`, e);
      job.status = "error";
      job.error = e instanceof Error ? e.message : String(e);
    }),
  );
  res.json({ id: job.id });
});

app.get("/api/render/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  const { file, ...rest } = job;
  res.json(rest);
});

app.get("/api/render/:id/file", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job?.file) return res.status(404).send("Belum selesai");
  const f = FORMATS[job.format];
  res.type(f.mime);
  res.download(job.file, `video.${f.ext}`);
});

// Hapus hasil render lebih dari 1 jam
setInterval(() => {
  for (const [id, job] of jobs) {
    if (Date.now() - job.createdAt > 3600_000) {
      if (job.file) fs.rm(job.file, { force: true }, () => {});
      jobs.delete(id);
    }
  }
}, 600_000).unref();

if (process.env.NODE_ENV === "production") {
  const dist = path.join(ROOT, "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`API render di http://localhost:${PORT}`);
  getServeUrl().then(() => console.log("[bundle] siap"), (e) => console.error("[bundle] gagal", e));
});
