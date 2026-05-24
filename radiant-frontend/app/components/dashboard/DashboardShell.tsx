import { cva } from "class-variance-authority"
import type { ReactNode } from "react"
import { RadiantLogo } from "../RadiantLogo"
import { Badge } from "../ui/Badge"
import { ScrollArea } from "../ui/ScrollArea"
import { LanguageSelector } from "./LanguageSelector"
import { DashboardSidebar } from "./DashboardSidebar"

type DashboardShellProps = {
	children?: ReactNode
	sidebar?: ReactNode | "default"
}

const shellVariants = cva("grid h-screen overflow-hidden text-neo-black bg-white", {
	variants: {
		hasSidebar: {
			true: "grid-cols-[4rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]",
			false: "grid-cols-1 grid-rows-[auto_minmax(0,1fr)]",
		},
	},
})

export function DashboardShell({ children, sidebar }: DashboardShellProps) {
	const hasSidebar = sidebar != null

	return (
		<main className={shellVariants({ hasSidebar })}>
			<div className="col-span-full border-b-3 border-neo-black bg-white px-6 py-4">
				<div className="flex items-center justify-between gap-4">
					<a href="/">
						<div className="flex items-center gap-6">
							<RadiantLogo />
							<Badge variant="mint">BETA</Badge>
						</div>
					</a>
					<LanguageSelector />
				</div>
			</div>
			{sidebar ? sidebar == "default" ? <DashboardSidebar/> : sidebar : null}
			<ScrollArea>{children}</ScrollArea>
		</main>
	)
}
