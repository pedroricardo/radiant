import { AtomHttpApi } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { ApiContract, User } from "@radiant/client"
import { Option } from "effect"

export const radioListReactivityKey = "radio:list"
export const currentUserReactivityKey = "user:current"

export class RadiantAtomClient extends AtomHttpApi.Tag<RadiantAtomClient>()("RadiantAtomClient", {
	api: ApiContract.httpApi,
	httpClient: FetchHttpClient.layer,
	baseUrl: "",
}) {}

export const radioListAtom = RadiantAtomClient.query("radio", "list", {
	reactivityKeys: [radioListReactivityKey],
})

export const createRadioAtom = RadiantAtomClient.mutation("radio", "create")

export type CurrentUser = typeof User.User.Type
export type CurrentUserEncoded = typeof User.User.Encoded

export const currentUserAtom = RadiantAtomClient.query("users", "getSelf", {
	reactivityKeys: [currentUserReactivityKey],
})
