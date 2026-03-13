import { HttpApi } from "@effect/platform"
import { authGroup } from "../Auth/Auth"
import { usersGroup } from "../User/Http"

export const httpApi = HttpApi.make("radiant").add(usersGroup).add(authGroup)

