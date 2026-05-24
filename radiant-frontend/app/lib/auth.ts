import { RadiantClient } from "@radiant/client"
import { Effect, Option } from "effect"
import { redirect } from "next/navigation"
import { cache } from "react"

import type { CurrentUser } from "./atoms/radiantClient"
import { runServerEffect } from "./serverApiClient"

export function getCurrentUserEffect() {
	return RadiantClient.use((client) => client.users.getSelf()).pipe(
		Effect.asSome,
		Effect.catchTag("Unauthorized", () => Effect.succeedNone),
		Effect.map((user): Option.Option<CurrentUser> => user),
	)
}

export const getCurrentUser = cache(() => runServerEffect(getCurrentUserEffect()))

export async function requireCurrentUser() {
	const currentUser = await getCurrentUser()

	if (Option.isNone(currentUser)) {
		redirect("/login")
	}

	return currentUser.value
}
