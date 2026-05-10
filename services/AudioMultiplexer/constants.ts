import type { Duration } from "effect"

export const DEFAULT_FRAME_SAMPLES = 1152
export const DEFAULT_SAMPLE_RATE = 44_100
export const DEFAULT_CHANNELS: 1 | 2 = 2
export const DEFAULT_CROSSFADE_DURATION: Duration.DurationInput = "500 millis"
