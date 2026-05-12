import { Option } from "effect"
import { redirect } from "next/navigation"

import { Panel } from "../components/dashboard/Panel"
import { PageHeader } from "../components/dashboard/PageHeader"
import { PanelGrid } from "../components/dashboard/PanelGrid"
import { SidebarNav } from "../components/dashboard/SidebarNav"
import { TopBar } from "../components/dashboard/TopBar"
import { Button } from "../components/ui/Button"
import { Skeleton } from "../components/ui/Skeleton"
import { getCurrentUser } from "../lib/auth"
import { runServerEffect } from "../lib/serverApiClient"

function DashboardSkeletonPanel(props: {
	title: string
	kicker?: string
	className?: string
	lines?: number
}) {
	return (
		<Panel title={props.title} kicker={props.kicker} className={props.className}>
			<div className="space-y-3">
				{Array.from({ length: props.lines ?? 4 }, (_, index) => (
					<Skeleton
						key={`${props.title}-${index}`}
						className={index === 0 ? "h-10 w-2/3" : index === (props.lines ?? 4) - 1 ? "h-4 w-1/3" : "h-4 w-full"}
					/>
				))}
			</div>
		</Panel>
	)
}

export default async function DashboardPage() {
	const user = await runServerEffect(getCurrentUser())
	if (Option.isNone(user)) {
		redirect("/login")
	}

	return (
		<main className="min-h-screen bg-canvas">
			<TopBar username={user.value.username} avatarUrl={user.value.avatarUrl ?? undefined} />
			<div className="grid min-h-[calc(100vh-5.25rem)] lg:grid-cols-[18rem_minmax(0,1fr)]">
				<div className="hidden lg:block">
					<SidebarNav />
				</div>

				<div className="min-w-0">

					<div className="p-4 sm:p-6">
					</div>
				</div>
			</div>
		</main>
	)
}
