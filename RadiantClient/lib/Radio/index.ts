import { Schema } from "effect"
import * as Id from "../Id"
export * as Errors from "./errors"
export const idPrefix = "radio" as const
export const RadioId = Id.schema(idPrefix)
export type RadioId = typeof RadioId.Type
export const RadioName = Schema.NonEmptyString.pipe(Schema.maxLength(120))
export const RadioDescription = Schema.NullOr(Schema.String.pipe(Schema.maxLength(2_000)))
export const RadioTimezone = Schema.NonEmptyString.pipe(Schema.maxLength(100))

export const RadioInfo = Schema.Struct({
	id: RadioId,
	name: RadioName,
	description: RadioDescription,
	timezone: RadioTimezone,
	defaultCrossfadeMs: Schema.Number,
	isPublic: Schema.Boolean,
	createdByUserId: Schema.String,
	createdAt: Schema.DateFromString,
	updatedAt: Schema.DateFromString,
})
