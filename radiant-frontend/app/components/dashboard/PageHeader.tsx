import { PropsWithChildren } from "react"

import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { StatusPill } from "./StatusPill"

export function PageHeader(props: {
	kicker: string
	title: string
	description: string
	statuses?: Array<{ label: string; variant?: "live" | "success" | "info" | "muted" | "danger" }>
	actions?: React.ReactNode
}) {
	return (
		<header className="border-b-3 border-neo-black bg-white px-6 py-6 sm:px-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<p className={`text-[10px] font-extrabold uppercase tracking-[0.24em] text-black/55 ${groteskFont.className}`}>
						{props.kicker}
					</p>
					<h1 className={`${tomorrowFont.className} mt-3 text-4xl font-extrabold uppercase text-neo-black sm:text-5xl`}>
						{props.title}
					</h1>
					<p className={`${groteskFont.className} mt-4 max-w-3xl text-base leading-7 text-black/70`}>
						{props.description}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					{props.statuses?.map((status) => (
						<StatusPill key={`${status.label}-${status.variant}`} variant={status.variant}>
							{status.label}
						</StatusPill>
					))}
					{props.actions}
				</div>
			</div>
		</header>
	)
}
