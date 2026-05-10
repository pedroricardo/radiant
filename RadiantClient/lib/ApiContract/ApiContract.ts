import { HttpApi } from "@effect/platform"
import { authGroup } from "../Auth/Auth"
import { radioGroup } from "../Radio/Http"
import { usersGroup } from "../User/Http"

export const httpApi = HttpApi.make("radiant")
	.add(usersGroup)
	.add(authGroup)
	.add(radioGroup)
	.prefix("/api")
