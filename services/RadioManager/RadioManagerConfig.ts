import { AudioMultiplexer } from "$services"
import { Context, Layer } from "effect"

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
