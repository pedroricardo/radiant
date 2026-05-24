"use client"

import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"

import { currentUserAtom } from "./radiantClient"

export function useCurrentUser() {
	return useAtomValue(currentUserAtom)
}

export function useOptionalCurrentUser() {
	const currentUser = useCurrentUser()
	return 	Result.value(currentUser)
}
