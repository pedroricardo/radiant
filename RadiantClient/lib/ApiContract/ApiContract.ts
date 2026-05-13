import { HttpApi } from "@effect/platform"
import { authGroup } from "../Auth/Auth"
import { mediaLibraryGroup } from "../MediaLibrary"
import { radioGroup } from "../Radio/Http"
import { usersGroup } from "../User/Http"

export const httpApi = HttpApi.make("radiant")
	.add(usersGroup)
	.add(authGroup)
	.add(radioGroup)
	.add(mediaLibraryGroup)
	.prefix("/api")
