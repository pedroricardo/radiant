import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Card } from "../ui/Card"

function HealthRow(props: { label: string; value: string; className?: string; valueClassName?: string; labelClassName?: string }) {
	return (
		<Card className={`flex items-center justify-between px-3 py-3 ${props.className ?? "bg-white"}`}>
			<span className={`${groteskFont.className} text-sm font-bold tracking-tight ${props.labelClassName ?? "text-black"}`}>
				{props.label}
			</span>
			<strong className={`${tomorrowFont.className} text-sm font-extrabold uppercase ${props.valueClassName ?? "text-neo-black"}`}>
				{props.value}
			</strong>
		</Card>
	)
}

export function StreamHealthCard() {
	return (
		<Card className="border-x-3 border-b-3 bg-blue-300 p-5 sm:border-l-0 sm:border-t-3">
			<p className={`text-[10px] font-extrabold uppercase tracking-[0.24em] text-black/60 ${groteskFont.className}`}>
				Stream health
			</p>
			<div className="mt-4 grid gap-3">
				<HealthRow label="Listener cache" value="30s" />
				<HealthRow label="Back pressure" value="Stable" />
				<HealthRow
					label="Sync"
					value="Locked"
					className="bg-neo-black"
					labelClassName="text-neo-paper"
					valueClassName="text-neo-mint"
				/>
			</div>
		</Card>
	)
}
