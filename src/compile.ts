import * as Babel from "@babel/standalone";
import React from "react";
import * as Remotion from "remotion";

/** Konfigurasi yang bisa diekspor dari file JSX: `export const config = {...}` */
export type CodeConfig = {
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
  background?: string;
};

export type CompileResult = {
  Component: React.ComponentType;
  config: CodeConfig;
};

/** Modul yang boleh di-`import` dari kode pengguna. */
const MODULES: Record<string, unknown> = {
  react: React,
  remotion: Remotion,
};

const cache = new Map<string, CompileResult>();

export function compileCode(code: string): CompileResult {
  const hit = cache.get(code);
  if (hit) return hit;

  const out = Babel.transform(code, {
    filename: "video.tsx",
    presets: [["react", { runtime: "classic" }], "typescript"],
    plugins: ["transform-modules-commonjs"],
  })?.code;
  if (!out) throw new Error("Kompilasi menghasilkan kode kosong");

  const require = (name: string) => {
    if (name in MODULES) return MODULES[name];
    throw new Error(
      `Modul "${name}" tidak tersedia. Yang bisa di-import: ${Object.keys(MODULES).join(", ")}`,
    );
  };
  const module = { exports: {} as Record<string, unknown> };
  // React & semua ekspor remotion juga tersedia tanpa import
  const scope: Record<string, unknown> = { ...Remotion, React };
  const fn = new Function("require", "module", "exports", ...Object.keys(scope), out);
  fn(require, module, module.exports, ...Object.values(scope));

  const exp = module.exports;
  const Component = (exp.default ?? exp.Video ?? exp.MyComposition) as React.ComponentType | undefined;
  if (typeof Component !== "function" && typeof Component !== "object") {
    throw new Error("Tidak ada komponen. Tambahkan `export default function NamaVideo() {...}`");
  }
  const config = (exp.config ?? {}) as CodeConfig;

  const result = { Component: Component as React.ComponentType, config };
  if (cache.size > 50) cache.clear();
  cache.set(code, result);
  return result;
}

/** Ambil config tanpa melempar error (untuk UI). */
export function tryReadConfig(code: string): CodeConfig {
  try {
    return compileCode(code).config;
  } catch {
    return {};
  }
}
