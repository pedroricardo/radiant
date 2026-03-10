import { Data, Effect, Ref } from "effect"
import type { OAuthUserInfo } from "./OAuthUserInfo"

export class OAuthValidationError extends Data.TaggedError("OAuthValidationError")<{
	message: string
	cause: unknown
}> {}

export interface OAuthProvider {
	readonly name: string
	readonly authUrl: Effect.Effect<string, never, never>
	exchangeCodeAndGetUserInfo(
		code: string,
	): Effect.Effect<OAuthUserInfo, OAuthValidationError, never>
}

export class OAuthProviderUnknownError extends Data.TaggedError("OAuthProviderUnknownError")<{
	availableProviders: string[]
	got: string
}> {
	override toString(): string {
		return `OAuthProviderUnknownError: unknown provider ${JSON.stringify(this.got)}, expected one of ${JSON.stringify(this.availableProviders)}`
	}
}

const makeRegistry = Effect.gen(function* () {
	const providers = yield* Ref.make(new Map<string, OAuthProvider>())
	return {
		addProvider: Effect.fn(function* (provider: OAuthProvider) {
			const providersMap = yield* providers.get
			const oldProvider = providersMap.get(provider.name)
			const rollback = () =>
				providers.pipe(
					Ref.update((map) =>
						oldProvider == null
							? (map.delete(provider.name), map)
							: map.set(provider.name, provider),
					),
				)
			let insertProvider = providers.pipe(Ref.update((map) => map.set(provider.name, provider)))
			yield* Effect.acquireRelease(insertProvider, rollback)
		}),
		getProvider: Effect.fn(function* (providerName: string) {
			const providersMap = yield* providers.get
			const provider = providersMap.get(providerName)
			if (provider == null) {
				return yield* new OAuthProviderUnknownError({
					availableProviders: providersMap.keys().toArray(),
					got: providerName,
				})
			}
			return provider
		}),
		listAvailableProviders: providers.get.pipe(Effect.map((m) => m.keys().toArray())),
	}
})
export class OAuthProvidersRegistry extends Effect.Service<OAuthProvidersRegistry>()(
	"OAuthProvidersRegistry",
	{ effect: makeRegistry },
) {}
