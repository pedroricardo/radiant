import type { User } from "$lib"
import { Data } from "effect"
import type { OAuthUserInfo } from "../OAuthUserInfo"

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
	userId: User.UserId
}> {}
export class AccountLinkError extends Data.TaggedError("AccountLinkError")<{
	message: string
	cause: unknown
	userInfo: OAuthUserInfo
	userId: User.UserId
}> {}
export class AccountLinkLookupError extends Data.TaggedError("AccountLinkLookupError")<{
	message: string
	cause: unknown
	oauthUserInfo: OAuthUserInfo
}> {}
