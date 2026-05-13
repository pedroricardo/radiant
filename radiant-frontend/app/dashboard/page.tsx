import { RadiantClient } from "@radiant/client"
import { Option } from "effect"
import { redirect } from "next/navigation"

import { getCurrentUser } from "../lib/auth"
import { runServerEffect } from "../lib/serverApiClient"
import { groteskFont, tomorrowFont } from "../lib/fonts"
import { Badge } from "../components/ui/Badge"
import { Button } from "../components/ui/Button"
import { DashboardShell } from "../components/dashboard/DashboardShell"
import { RadioTile } from "../components/dashboard/RadioTile"

export default async function DashboardPage() {
	const user = await runServerEffect(getCurrentUser())

	if (Option.isNone(user)) {
		redirect("/login")
	}

	const radios = await runServerEffect(RadiantClient.use((client) => client.radio.list()))

	return (
		<DashboardShell user={user.value}>
			<div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-6 py-10">
				<div className="flex flex-col items-center gap-4 text-center">
					<Badge variant="orange">Dashboard</Badge>

					<h1
						className={`select-none text-center text-4xl tracking-tight text-neo-black sm:text-5xl ${tomorrowFont.className}`}
					>
						Selecione um Rádio
					</h1>

					<p
						className={`max-w-xl select-none text-sm font-bold tracking-tight text-black/65 sm:text-base ${groteskFont.className}`}
					>
						Escolhe uma estação para abrir o console, acompanhar a automação e gerir a library.
					</p>
				</div>

				<div className="mt-12 flex flex-wrap items-start justify-center gap-8">
					{radios.map((radio) => (
						<RadioTile key={radio.id} id={radio.id} name={radio.name} />
					))}
				</div>

				{radios.length === 0 ? (
					<div className="mt-12 flex flex-col items-center gap-4 border-3 border-neo-black bg-neo-paper px-6 py-6 shadow-neo-badge">
						<p className={`select-none text-center text-base text-black/70 ${groteskFont.className}`}>
							Ainda não tens rádios. Cria a primeira estação para começar.
						</p>

						<Button variant="default">Criar rádio</Button>
					</div>
				) : null}
			</div>
		</DashboardShell>
	)
}
