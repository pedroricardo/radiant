import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Panel } from "./Panel"
import { StatusPill } from "./StatusPill"

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const blocks = [
	{ day: 0, start: 8, span: 5, label: "Sunrise AutoDJ", tone: "bg-signal" },
	{ day: 1, start: 11, span: 4, label: "Festival Cuts", tone: "bg-surface-accent" },
	{ day: 3, start: 6, span: 7, label: "Drive Time", tone: "bg-signal-warm" },
	{ day: 5, start: 13, span: 6, label: "Weekend Loop", tone: "bg-surface-live text-white" },
]

export function ScheduleMiniPanel() {
	return (
		<Panel title="Schedule View" kicker="Visual calendar" className="lg:col-span-7">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className={`${groteskFont.className} text-sm font-bold tracking-tight text-neo-black`}>
						Timezone: Europe/Lisbon
					</p>
					<p className={`${groteskFont.className} mt-1 text-sm leading-6 text-black/65`}>
						Visual-only calendar shell for weekly blocks, one-offs, and conflict overlays.
					</p>
				</div>
				<StatusPill variant="info">Visual V1</StatusPill>
			</div>

			<div className="overflow-hidden border-3 border-neo-black bg-surface-muted shadow-neo-badge">
				<div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b-3 border-neo-black bg-white">
					<div className="border-r-3 border-neo-black px-2 py-3" />
					{days.map((day) => (
						<div
							key={day}
							className={`border-r-3 border-neo-black px-3 py-3 text-center text-xs font-extrabold uppercase text-neo-black last:border-r-0 ${tomorrowFont.className}`}
						>
							{day}
						</div>
					))}
				</div>

				<div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
					<div className="border-r-3 border-neo-black bg-white">
						{["06", "09", "12", "15", "18", "21"].map((hour) => (
							<div
								key={hour}
								className={`h-16 border-b-2 border-black/10 px-2 py-2 text-[10px] font-extrabold uppercase text-black/55 ${tomorrowFont.className}`}
							>
								{hour}:00
							</div>
						))}
					</div>

					<div className="relative col-span-7 grid grid-cols-7 bg-surface-muted">
						{days.map((day) => (
							<div key={day} className="border-r-2 border-black/10 last:border-r-0">
								{Array.from({ length: 6 }).map((_, index) => (
									<div key={index} className="h-16 border-b-2 border-black/10" />
								))}
							</div>
						))}

						{blocks.map((block) => (
							<div
								key={`${block.day}-${block.label}`}
								className={`absolute left-[calc(4px+(${block.day}*(100%/7)))] w-[calc((100%/7)-8px)] border-3 border-neo-black px-3 py-2 shadow-neo-badge ${block.tone}`}
								style={{ top: `${block.start * 12}px`, height: `${block.span * 12}px` }}
							>
								<p className={`${tomorrowFont.className} text-[10px] font-extrabold uppercase`}>
									Playlist
								</p>
								<p className={`${groteskFont.className} mt-1 text-xs font-bold tracking-tight`}>
									{block.label}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</Panel>
	)
}
