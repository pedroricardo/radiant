import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { User, UserId } from "."
import { Authorization } from "../Auth"

const idParam = HttpApiSchema.param("id", UserId)

export const usersGroup = HttpApiGroup.make("users")
	.add(HttpApiEndpoint.get("getUser")`/${idParam}`.addSuccess(User).middleware(Authorization))
	.add(HttpApiEndpoint.get("getSelf")`/me`.addSuccess(User).middleware(Authorization))
	.prefix("/users")
