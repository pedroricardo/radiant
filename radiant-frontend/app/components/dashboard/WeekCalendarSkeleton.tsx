import { groteskFont, tomorrowFont } from "../../lib/fonts"

const weekDays = [
	{ shortLabel: "Seg" },
	{ shortLabel: "Ter" },
	{ shortLabel: "Qua" },
	{ shortLabel: "Qui" },
	{ shortLabel: "Sex" },
	{ shortLabel: "Sab" },
	{ shortLabel: "Dom" },
] as const

const hourLabels = Array.from({ length: 18 }, (_, index) => {
	const hour = String(index).padStart(2, "0")
	return `${hour}:00`
})

export function WeekCalendarSkeleton() {
	return (
		<div className="flex items-center justify-stretch w-full h-20">
			{new Array(7).map((_, i) => <div key={i} style={{backgroundColor: `hsl(${i*10}, 100%, 100%)`}}>

			</div>)}
		</div>
	)
}
