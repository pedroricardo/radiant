import { Schema } from "effect"

export const User = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	createdAt: Schema.DateTimeUtc,
})

