import { RadiantClient } from "@radiant/client"
import { Option } from "effect"
import { redirect } from "next/navigation"

import { DashboardRadioPicker } from "../components/dashboard/DashboardRadioPicker"
import { DashboardShell } from "../components/dashboard/DashboardShell"
import { getCurrentUser } from "../lib/auth"
import { runServerEffect } from "../lib/serverApiClient"

export default async function DashboardPage() {
	const user = await runServerEffect(getCurrentUser())

	if (Option.isNone(user)) {
		redirect("/login")
	}

	const radios = await runServerEffect(RadiantClient.use((client) => client.radio.list()))

	return (
		<DashboardShell user={user.value}>
			<DashboardRadioPicker initialRadios={radios} />
		</DashboardShell>
	)
}
