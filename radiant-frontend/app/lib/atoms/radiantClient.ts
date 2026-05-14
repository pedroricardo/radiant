import { Atom, AtomHttpApi, Result } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { ApiContract } from "@radiant/client"
import { Option } from "effect"

export const radioListReactivityKey = "radio:list"

export class RadiantAtomClient extends AtomHttpApi.Tag<RadiantAtomClient>()("RadiantAtomClient", {
	api: ApiContract.httpApi,
	httpClient: FetchHttpClient.layer,
	baseUrl: "",
}) {}

export const radioListAtom = RadiantAtomClient.query("radio", "list", {
	reactivityKeys: [radioListReactivityKey],
})

export const createRadioAtom = RadiantAtomClient.mutation("radio", "create")
