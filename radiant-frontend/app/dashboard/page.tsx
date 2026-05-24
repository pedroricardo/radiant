import { RadiantClient } from "@radiant/client"

import { DashboardRadioPicker } from "../components/dashboard/DashboardRadioPicker"
import { runServerEffect } from "../lib/serverApiClient"
import { DashboardShell } from "../components/dashboard/DashboardShell"

export default async function DashboardPage() {
	const radios = await runServerEffect(RadiantClient.use((client) => client.radio.list()))

	return <DashboardShell sidebar="default">
		<DashboardRadioPicker initialRadios={radios} />
	</DashboardShell>
}
