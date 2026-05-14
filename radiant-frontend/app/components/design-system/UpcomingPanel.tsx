import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Card } from "../ui/Card"
import { Panel } from "./Panel"

const items = [
	{ time: "18:30", title: "Station IDs + Ads", tone: "bg-surface-muted" },
	{ time: "19:00", title: "Night Circuit", tone: "bg-signal" },
	{ time: "20:30", title: "Loose Singles", tone: "bg-surface-accent" },
]

export function UpcomingPanel() {
	return (
		<Panel title="Upcoming" kicker="Clock aware" className="lg:col-span-4">
			<div className="space-y-3">
				{items.map((item) => (
					<Card key={`${item.time}-${item.title}`} className={`${item.tone} px-3 py-3`}>
						<p
							className={`${tomorrowFont.className} text-xs font-extrabold uppercase text-neo-black`}
						>
							{item.time}
						</p>
						<p
							className={`${groteskFont.className} mt-1 text-sm font-bold tracking-tight text-black`}
						>
							{item.title}
						</p>
					</Card>
				))}
			</div>
		</Panel>
	)
}
