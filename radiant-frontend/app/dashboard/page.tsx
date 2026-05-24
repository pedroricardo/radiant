import { RadiantClient } from "@radiant/client"

import { DashboardRadioPicker } from "../components/dashboard/DashboardRadioPicker"
import { runServerEffect } from "../lib/serverApiClient"

export default async function DashboardPage() {
	const radios = await runServerEffect(RadiantClient.use((client) => client.radio.list()))

	return <DashboardRadioPicker initialRadios={radios} />
}
