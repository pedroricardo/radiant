import { AudioMultiplexer } from "./AudioMultiplexer"

export {
	MultiplexerCommandQueueError,
	MultiplexerInvalidConfigError,
	MultiplexerInvalidCrossfadeDurationError,
	MultiplexerInvalidMasterVolumeError,
	MultiplexerInvalidSourceVolumeError,
	MultiplexerSourceChannelMismatchError,
	MultiplexerSourceFrameShapeError,
	MultiplexerSourceInvalidSampleRateError,
	MultiplexerSourcePullError,
	type MultiplexerError,
} from "./Error"
export type { AudioMultiplexerConfig, MultiplexerSourceInput } from "./types"
export { AudioMultiplexer }
export const layer = AudioMultiplexer.Default
