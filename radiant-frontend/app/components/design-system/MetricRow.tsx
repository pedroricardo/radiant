import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Card } from "../ui/Card"

export function MetricRow(props: {
	label: string
	value: string
	emphasis?: "default" | "inverse"
}) {
	const inverse = props.emphasis === "inverse"

	return (
		<Card
			className={
				inverse
					? "flex items-center justify-between bg-surface-strong px-3 py-3"
					: "flex items-center justify-between bg-white px-3 py-3"
			}
		>
			<span
				className={`${groteskFont.className} text-sm font-bold tracking-tight ${inverse ? "text-surface-muted" : "text-neo-black"}`}
			>
				{props.label}
			</span>
			<strong
				className={`${tomorrowFont.className} text-sm font-extrabold uppercase ${inverse ? "text-signal" : "text-neo-black"}`}
			>
				{props.value}
			</strong>
		</Card>
	)
}
