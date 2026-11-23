import type { CodeConfig } from "./compile";

export type AspectPreset = "fit" | "1:1" | "9:16" | "16:9" | "4:5";
export type LayoutMode = "responsive" | "contain" | "cover";

export const PRESETS: { id: AspectPreset; label: string; width?: number; height?: number; hint: string }[] = [
  { id: "fit", label: "Fit JSX", hint: "Ikuti config di file" },
  { id: "16:9", label: "16:9", width: 1920, height: 1080, hint: "YouTube" },
  { id: "9:16", label: "9:16", width: 1080, height: 1920, hint: "Reels / TikTok" },
  { id: "1:1", label: "1:1", width: 1080, height: 1080, hint: "Feed persegi" },
  { id: "4:5", label: "4:5", width: 1080, height: 1350, hint: "Feed portrait" },
];

export const DEFAULTS = { width: 1920, height: 1080, fps: 30, durationInFrames: 150 };

export function resolveSize(preset: AspectPreset, config: CodeConfig) {
  const designWidth = config.width ?? DEFAULTS.width;
  const designHeight = config.height ?? DEFAULTS.height;
  const p = PRESETS.find((x) => x.id === preset);
  const width = preset === "fit" || !p?.width ? designWidth : p.width;
  const height = preset === "fit" || !p?.height ? designHeight : p.height!;
  return { width, height, designWidth, designHeight };
}

/** Lebar/tinggi video harus genap untuk H.264. */
export const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
