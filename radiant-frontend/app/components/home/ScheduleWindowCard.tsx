import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Card } from "../ui/Card"

function WindowItem(props: { range: string; title: string; className: string }) {
	return (
		<Card className={`px-3 py-3 ${props.className}`}>
			<p className={`${tomorrowFont.className} text-xs font-extrabold uppercase`}>{props.range}</p>
			<p className={`${groteskFont.className} mt-1 font-bold tracking-tight text-black`}>{props.title}</p>
		</Card>
	)
}

export function ScheduleWindowCard() {
	return (
		<Card className="bg-white p-5">
			<p className={`text-[10px] font-extrabold uppercase tracking-[0.24em] text-black/60 ${groteskFont.className}`}>
				Current window
			</p>
			<div className="mt-4 space-y-3">
				<WindowItem range="18:00 — 19:30" title="Sunset Rotation" className="bg-neo-mint" />
				<WindowItem range="19:30 — 20:00" title="Station IDs + Ads" className="bg-neo-paper" />
			</div>
		</Card>
	)
}
