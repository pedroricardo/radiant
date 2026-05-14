import Link from "next/link"

import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Badge } from "../ui/Badge"

type RadioTileProps = {
	id: string
	name: string
}

export function RadioTile({ id, name }: RadioTileProps) {
	const displayName = name
		.split(" ")
		.slice(0, 2)
		.map((word) => word.slice(0, 6))
		.join(" ")

	return (
		<Link href={`/dashboard/radios/${id}`} className="group flex flex-col items-center gap-3">
			<div className="flex w-[11rem] flex-col border-3 border-neo-black bg-white shadow-neo-panel-mobile transition-transform group-hover:-translate-y-1">
				<div className="flex min-h-[8.5rem] items-center justify-center border-b-3 border-neo-black bg-linear-to-br from-[#101010] via-[#171717] to-[#ff4d3d] px-4 text-white">
					<div className="text-center">
						<div
							className={`text-[10px] font-bold uppercase tracking-[0.24em] text-[#58efb0] ${groteskFont.className}`}
						>
							Radio
						</div>

						<div
							className={`mt-2 text-2xl font-extrabold uppercase leading-none ${tomorrowFont.className}`}
						>
							{displayName}
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 px-3 py-3">
					<div
						className={`min-w-0 text-sm font-bold tracking-tight text-neo-black ${groteskFont.className}`}
					>
						<div className="truncate">{name}</div>
					</div>

					<Badge variant="mint" className="px-2 py-1 text-[9px] shadow-none">
						open
					</Badge>
				</div>
			</div>
		</Link>
	)
}
