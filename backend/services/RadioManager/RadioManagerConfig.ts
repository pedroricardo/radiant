import { Context, Layer } from "effect"
import * as AudioMultiplexer from "../AudioMultiplexer"

export class RadioManagerConfig extends Context.Tag("RadioManagerConfig")<
	RadioManagerConfig,
	{
		audioMultiplexerLayer: Layer.Layer<
			AudioMultiplexer.AudioMultiplexer,
			AudioMultiplexer.MultiplexerError
		>
	}
>() {
	static readonly Default = Layer.succeed(RadioManagerConfig, {
		audioMultiplexerLayer: AudioMultiplexer.layer,
	})
}
