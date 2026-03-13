import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { User } from "./User"

const idParam = HttpApiSchema.param("id", Schema.NumberFromString)

export const usersGroup = HttpApiGroup.make("users").add(
	HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User),
)

