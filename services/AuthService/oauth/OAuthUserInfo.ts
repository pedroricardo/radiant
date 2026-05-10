import { Data } from "effect"

export class OAuthUserInfo extends Data.TaggedClass("OAuthUserInfo")<{
	id: string
	username: string
	email: string
	avatarUrl: URL
	providerName: string
}> {}
