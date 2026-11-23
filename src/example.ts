export const EXAMPLE = `import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

// Opsional: ukuran asli desain. Dipakai saat ukuran "Fit JSX" dipilih.
export const config = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
  background: "#0f172a",
};

export default function MyVideo() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const size = Math.min(width, height);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f172a, #4338ca)", justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ color: "white", fontFamily: "sans-serif", fontSize: size * 0.12, transform: \`scale(\${scale})\`, opacity, margin: 0 }}>
        Halo Remotion
      </h1>
      <Sequence from={40}>
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: size * 0.12 }}>
          <Subtitle />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

function Subtitle() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const y = interpolate(frame, [0, 15], [40, 0], { extrapolateRight: "clamp" });
  return (
    <p style={{ color: "#c7d2fe", fontFamily: "sans-serif", fontSize: Math.min(width, height) * 0.045, transform: \`translateY(\${y}px)\`, margin: 0 }}>
      {width} × {height}
    </p>
  );
}
`;
