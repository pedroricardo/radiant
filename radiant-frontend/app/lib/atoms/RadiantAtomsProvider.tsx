"use client"

import { RegistryProvider, Result } from "@effect-atom/atom-react"
import type { ReactNode } from "react"

import { currentUserAtom, type CurrentUserEncoded } from "./radiantClient"
import { Schema } from "effect"
import { User } from "@radiant/client"
import { Unauthorized } from "@radiant/client/contract"

type RadiantAtomsProviderProps = {
	currentUser: CurrentUserEncoded | null
	children: ReactNode
}

export function RadiantAtomsProvider({ currentUser, children }: RadiantAtomsProviderProps) {
	return <RegistryProvider initialValues={[[currentUserAtom, currentUser ? Result.success(Schema.decodeSync(User.User)(currentUser)) : Result.fail(new Unauthorized())]]}>{children}</RegistryProvider>
}
