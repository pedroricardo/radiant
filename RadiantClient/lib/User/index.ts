import { Schema } from "effect"
import * as Id from "../Id"
export const idPrefix = "user" as const
export const UserId = Id.schema(idPrefix)
export type UserId = typeof UserId.Type

export const User = Schema.Struct({
	id: UserId,
	username: Schema.String,
	email: Schema.String,
	avatarUrl: Schema.String,
	storageQuotaBytes: Schema.NullOr(
		Schema.NonNegativeBigInt
	),
	createdAt: Schema.DateTimeUtc,
})

export type User = typeof User.Type
