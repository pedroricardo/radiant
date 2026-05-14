import { PropsWithChildren } from "react"

import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"
import { Card, CardContent } from "./Card"

type EmptyStateProps = PropsWithChildren<{
	title: string
	description?: string
	className?: string
}>

export function EmptyState(props: EmptyStateProps) {
	return (
		<Card className={cn("bg-surface-muted", props.className)}>
			<CardContent className="p-6">
				<p className={`${tomorrowFont.className} text-sm font-extrabold uppercase text-neo-black`}>
					{props.title}
				</p>
				{props.description ? (
					<p className={`${groteskFont.className} mt-2 text-sm leading-6 text-black/70`}>
						{props.description}
					</p>
				) : null}
				{props.children ? <div className="mt-4">{props.children}</div> : null}
			</CardContent>
		</Card>
	)
}
