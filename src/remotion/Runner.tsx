import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { compileCode } from "../compile";
import type { LayoutMode } from "../sizes";

export type RunnerProps = {
  code: string;
  layout: LayoutMode;
  /** Ukuran asli desain (dari config JSX) — dipakai untuk mode contain/cover. */
  designWidth: number;
  designHeight: number;
  transparent?: boolean;
};

export const Runner: React.FC<RunnerProps> = ({ code, layout, designWidth, designHeight, transparent }) => {
  const { width, height } = useVideoConfig();
  const { Component, config } = useMemo(() => compileCode(code), [code]);
  const bg = transparent ? "transparent" : (config.background ?? "#000");

  if (layout === "responsive" || (width === designWidth && height === designHeight)) {
    return <Component />;
  }

  // contain / cover: render di ukuran desain asli, lalu diskalakan ke kanvas baru
  const sx = width / designWidth;
  const sy = height / designHeight;
  const scale = layout === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: designWidth,
          height: designHeight,
          left: (width - designWidth * scale) / 2,
          top: (height - designHeight * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Sequence dengan width/height membuat useVideoConfig() di dalam kode
            pengguna tetap mengembalikan ukuran desain asli. */}
        <Sequence name="Design" width={designWidth} height={designHeight}>
          <Component />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
