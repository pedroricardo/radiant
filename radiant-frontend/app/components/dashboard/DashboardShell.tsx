import type { ReactNode } from "react"
import { RadiantLogo } from "../RadiantLogo"
import { Badge } from "../ui/Badge"
import { DashboardSidebar } from "./DashboardSidebar"

type DashboardShellProps = {
	user: {
		username: string
		avatarUrl?: string | null
	}
	children: ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
	return (
		<main className="min-h-screen text-neo-black grid-rows-[auto_1fr] grid">
			<div className="border-b-3 border-neo-black bg-white px-6 py-4">
				<a href="/">
					<div className="flex items-center gap-6">
						<RadiantLogo />
						<Badge variant="mint">BETA</Badge>
					</div>
				</a>
			</div>
			<div className="grid grid-cols-[4rem_minmax(0,1fr)] bg-white">
				<DashboardSidebar user={user} />
				<section className="overflow-hidden bg-white">{children}</section>
			</div>
		</main>
	)
}
