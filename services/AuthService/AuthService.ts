import { Data, Effect } from "effect"
import { OAuthProvidersRegistry } from "./oauth"

export class OAuthProviderUnknown extends Data.TaggedError("OAuthProviderUnknown")<{
	availableProviders: string[]
	got: string
}> {
	override toString(): string {
		return `OAuthProviderUnknown: unknown provider ${JSON.stringify(this.got)}, expected one of ${JSON.stringify(this.availableProviders)}`
	}
}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	accessors: true,
	effect: Effect.gen(function* () {
		let providers = yield* OAuthProvidersRegistry

		return {
			listAvailableOAuthProviders: providers.listAvailableProviders,
			finishOAuthLoginAndGetUserId: Effect.fn(function* (provider: string) {}),
		}
	}),
}) {}
