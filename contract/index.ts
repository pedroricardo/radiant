import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	createdAt: Schema.DateTimeUtc,
})

const idParam = HttpApiSchema.param("id", Schema.NumberFromString)

const usersGroup = HttpApiGroup.make("users").add(
	HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User),
)

export const radiantApi = HttpApi.make("radiant").add(usersGroup)
