export { AudioMultiplexer } from "./service"
export type { AudioMultiplexerConfig, MultiplexerSourceInput } from "./types"
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
} from "./errors"
