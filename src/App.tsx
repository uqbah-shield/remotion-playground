import "./monaco";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Player, type PlayerRef } from "@remotion/player";
import { compileCode, type CodeConfig } from "./compile";
import { Runner, type RunnerProps } from "./remotion/Runner";
import { DEFAULTS, PRESETS, even, resolveSize, type AspectPreset, type LayoutMode } from "./sizes";
import { EXAMPLE } from "./example";

type Format = "mp4" | "webm" | "mov";
type Job = { id: string; status: string; progress: number; format: Format; error?: string };

const STORAGE_KEY = "remotion-playground:code";
const load = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? EXAMPLE;
  } catch {
    return EXAMPLE;
  }
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function App() {
  const [code, setCode] = useState(load);
  const [fileName, setFileName] = useState("video.jsx");
  const debounced = useDebounced(code, 400);

  const [preset, setPreset] = useState<AspectPreset>("fit");
  const [layout, setLayout] = useState<LayoutMode>("responsive");
  const [fpsOverride, setFpsOverride] = useState<number | null>(null);
  const [secondsOverride, setSecondsOverride] = useState<number | null>(null);
  const [format, setFormat] = useState<Format>("mp4");
  const [transparent, setTransparent] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {}
  }, [code]);

  // Kompilasi untuk validasi + membaca config dari file JSX
  const compiled = useMemo((): { config: CodeConfig; error: string | null } => {
    try {
      return { config: compileCode(debounced).config, error: null };
    } catch (e) {
      return { config: {}, error: e instanceof Error ? e.message : String(e) };
    }
  }, [debounced]);
  // Simpan config terakhir yang valid agar ukuran tidak melompat saat kode sedang error
  const lastValid = useRef({ code: EXAMPLE, config: {} as CodeConfig });
  if (!compiled.error) lastValid.current = { code: debounced, config: compiled.config };
  const config = lastValid.current.config;
  const previewCode = lastValid.current.code;

  // Jika komponen crash saat runtime, Player di-mount ulang begitu kode berubah
  const [playerKey, setPlayerKey] = useState(0);
  const crashed = useRef(false);
  useEffect(() => {
    if (crashed.current) {
      crashed.current = false;
      setPlayerKey((k) => k + 1);
    }
  }, [previewCode]);

  const fps = fpsOverride ?? config.fps ?? DEFAULTS.fps;
  const durationInFrames = Math.max(
    1,
    secondsOverride != null
      ? Math.round(secondsOverride * fps)
      : (config.durationInFrames ?? DEFAULTS.durationInFrames),
  );
  const size = resolveSize(preset, config);
  const width = even(size.width);
  const height = even(size.height);
  const designWidth = even(size.designWidth);
  const designHeight = even(size.designHeight);

  const inputProps: RunnerProps = { code: previewCode, layout, designWidth, designHeight, transparent };

  // Polling status render
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/render/${job.id}`);
      if (r.ok) setJob(await r.json());
    }, 700);
    return () => clearInterval(t);
  }, [job]);

  const busy = !!job && job.status !== "done" && job.status !== "error";

  async function startRender() {
    setJob({ id: "", status: "queued", progress: 0, format });
    const r = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputProps, code, format, width, height, fps, durationInFrames }),
    });
    const data = await r.json();
    if (!r.ok) return setJob({ id: "", status: "error", progress: 0, format, error: data.error });
    setJob({ id: data.id, status: "queued", progress: 0, format });
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setCode(text);
      setFileName(file.name);
      setPreset("fit");
      setFpsOverride(null);
      setSecondsOverride(null);
    });
    e.target.value = "";
  }

  function downloadCode() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = fileName;
    a.click();
  }

  const statusLabel: Record<string, string> = {
    queued: "Antre…",
    bundling: "Menyiapkan bundle…",
    rendering: "Merender",
    done: "Selesai",
    error: "Gagal",
  };

  return (
    <div className="app">
      <header>
        <strong>Remotion Playground</strong>
        <span className="file">{fileName}</span>
        <div className="spacer" />
        <input ref={fileInput} type="file" accept=".jsx,.tsx,.js,.ts" hidden onChange={onUpload} />
        <button onClick={() => fileInput.current?.click()}>Buka file JSX</button>
        <button onClick={downloadCode}>Simpan kode</button>
        <button
          onClick={() => {
            if (confirm("Ganti kode dengan contoh awal?")) {
              setCode(EXAMPLE);
              setFileName("video.jsx");
            }
          }}
        >
          Contoh
        </button>
      </header>

      <main>
        <section className="editor">
          <Editor
            path="video.tsx"
            language="typescript"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 14, tabSize: 2, automaticLayout: true }}
          />
        </section>

        <section className="side">
          <div className="panel">
            <label className="title">Ukuran video</label>
            <div className="presets">
              {PRESETS.map((p) => {
                const w = p.width ?? size.designWidth;
                const h = p.height ?? size.designHeight;
                const k = 28 / Math.max(w, h);
                return (
                  <button
                    key={p.id}
                    className={preset === p.id ? "active" : ""}
                    onClick={() => setPreset(p.id)}
                    title={p.hint}
                  >
                    <span className="shape" style={{ width: w * k, height: h * k }} />
                    <span>{p.label}</span>
                    <small>
                      {w}×{h}
                    </small>
                  </button>
                );
              })}
            </div>

            {preset !== "fit" && (width !== designWidth || height !== designHeight) && (
              <div className="row">
                <label>Penyesuaian konten</label>
                <select value={layout} onChange={(e) => setLayout(e.target.value as LayoutMode)}>
                  <option value="responsive">Responsif (kanvas berubah, pakai useVideoConfig)</option>
                  <option value="contain">Contain (skala desain asli, ada bar)</option>
                  <option value="cover">Cover (skala desain asli, terpotong)</option>
                </select>
              </div>
            )}

            <div className="row two">
              <div>
                <label>FPS</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={fps}
                  onChange={(e) => setFpsOverride(Number(e.target.value) || null)}
                />
              </div>
              <div>
                <label>Durasi (detik)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={+(durationInFrames / fps).toFixed(2)}
                  onChange={(e) => setSecondsOverride(Number(e.target.value) || null)}
                />
              </div>
            </div>
            {(fpsOverride != null || secondsOverride != null) && (
              <button
                className="link"
                onClick={() => {
                  setFpsOverride(null);
                  setSecondsOverride(null);
                }}
              >
                Kembalikan FPS & durasi ke config JSX
              </button>
            )}
          </div>

          <div className="preview">
            {compiled.error && <pre className="error">{compiled.error}</pre>}
            <Player
              key={`${width}x${height}-${playerKey}`}
              ref={playerRef}
              component={Runner}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              controls
              loop
              autoPlay
              acknowledgeRemotionLicense
              className={transparent ? "checker" : ""}
              style={{ width: "100%", maxHeight: "100%", aspectRatio: `${width} / ${height}` }}
              errorFallback={({ error }) => {
                crashed.current = true;
                return <pre className="error inside">{error.message}</pre>;
              }}
            />
          </div>

          <div className="panel">
            <label className="title">Render</label>
            <div className="formats">
              {(["mp4", "webm", "mov"] as Format[]).map((f) => (
                <button key={f} className={format === f ? "active" : ""} onClick={() => setFormat(f)}>
                  {f.toUpperCase()}
                  <small>{{ mp4: "H.264", webm: "VP9", mov: "ProRes" }[f]}</small>
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={transparent && format !== "mp4"}
                disabled={format === "mp4"}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Background transparan {format === "mp4" ? "(hanya WebM/MOV)" : ""}
            </label>
            <button className="primary" disabled={busy || !!compiled.error} onClick={startRender}>
              {busy ? "Merender…" : `Render ${format.toUpperCase()} · ${width}×${height}`}
            </button>

            {job && (
              <div className="job">
                <div className="bar">
                  <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
                </div>
                <span>
                  {statusLabel[job.status] ?? job.status}
                  {job.status === "rendering" ? ` ${Math.round(job.progress * 100)}%` : ""}
                </span>
                {job.status === "done" && (
                  <a className="download" href={`/api/render/${job.id}/file`}>
                    Unduh video.{job.format}
                  </a>
                )}
                {job.error && <pre className="error">{job.error}</pre>}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
