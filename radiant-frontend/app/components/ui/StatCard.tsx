import { PropsWithChildren } from "react"

import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"
import { Card, CardContent } from "./Card"

type StatCardProps = PropsWithChildren<{
	label: string
	accentClassName?: string
	className?: string
	valueClassName?: string
}>

export function StatCard(props: StatCardProps) {
	return (
		<Card className={cn("bg-white", props.accentClassName, props.className)}>
			<CardContent className="p-4">
				<p
					className={`text-[10px] font-extrabold uppercase tracking-[0.22em] text-black/65 ${groteskFont.className}`}
				>
					{props.label}
				</p>
				<p
					className={cn(
						`${tomorrowFont.className} mt-2 text-xl font-extrabold uppercase text-neo-black`,
						props.valueClassName,
					)}
				>
					{props.children}
				</p>
			</CardContent>
		</Card>
	)
}
