import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { User, UserId } from "."
import { Authorization } from "../Auth"

const idParam = HttpApiSchema.param("id", UserId)
export const UserStorageInfo = Schema.Struct({
	quotaBytes: Schema.BigInt,
	usedBytes: Schema.BigInt,
	remainingBytes: Schema.BigInt,
})

export const usersGroup = HttpApiGroup.make("users")
	.add(HttpApiEndpoint.get("getUser")`/${idParam}`.addSuccess(User).middleware(Authorization))
	.add(HttpApiEndpoint.get("getSelf")`/me`.addSuccess(User).middleware(Authorization))
	.add(HttpApiEndpoint.get("getSelfStorage")`/me/storage`.addSuccess(UserStorageInfo).middleware(Authorization))
	.prefix("/users")
