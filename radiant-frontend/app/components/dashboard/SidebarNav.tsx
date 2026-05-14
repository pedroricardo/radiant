import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"
import { ScrollArea } from "../ui/ScrollArea"

const sections = [
	{
		title: "Radio",
		items: [
			{ label: "Overview", active: true },
			{ label: "Playout" },
			{ label: "Preview" },
			{ label: "Outputs" },
		],
	},
	{
		title: "Programming",
		items: [{ label: "Calendar" }, { label: "Playlists" }, { label: "Interruptions" }],
	},
	{
		title: "Library",
		items: [{ label: "Media VFS" }, { label: "Uploads" }, { label: "Metadata" }],
	},
]

export function SidebarNav() {
	return (
		<aside className="border-r-3 border-neo-black bg-surface-muted">
			<div className="border-b-3 border-neo-black px-5 py-4">
				<p
					className={`text-[10px] font-extrabold uppercase tracking-[0.22em] text-black/55 ${groteskFont.className}`}
				>
					Console
				</p>
				<p
					className={`${tomorrowFont.className} mt-3 text-xl font-extrabold uppercase text-neo-black`}
				>
					Studio Panel
				</p>
			</div>

			<ScrollArea className="h-[calc(100vh-5.25rem)]">
				<div className="space-y-8 px-4 py-5">
					{sections.map((section) => (
						<div key={section.title}>
							<p
								className={`px-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-black/45 ${groteskFont.className}`}
							>
								{section.title}
							</p>
							<div className="mt-3 space-y-2">
								{section.items.map((item) => (
									<div
										key={item.label}
										className={cn(
											`border-3 px-3 py-3 text-sm font-bold tracking-tight shadow-neo-badge ${groteskFont.className}`,
											item.active
												? "border-neo-black bg-white text-neo-black"
												: "border-transparent bg-surface-accent/55 text-black/70",
										)}
									>
										{item.label}
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
		</aside>
	)
}
