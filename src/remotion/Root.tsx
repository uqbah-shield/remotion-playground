import { Composition } from "remotion";
import { Runner, type RunnerProps } from "./Runner";
import { DEFAULTS } from "../sizes";

export type RenderInputProps = RunnerProps & {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

const defaultProps: RenderInputProps = {
  code: "export default () => null;",
  layout: "responsive",
  designWidth: DEFAULTS.width,
  designHeight: DEFAULTS.height,
  ...DEFAULTS,
};

export const Root: React.FC = () => (
  <Composition
    id="Runner"
    component={Runner as unknown as React.FC<RenderInputProps>}
    defaultProps={defaultProps}
    width={DEFAULTS.width}
    height={DEFAULTS.height}
    fps={DEFAULTS.fps}
    durationInFrames={DEFAULTS.durationInFrames}
    calculateMetadata={({ props }) => ({
      width: props.width,
      height: props.height,
      fps: props.fps,
      durationInFrames: props.durationInFrames,
    })}
  />
);
