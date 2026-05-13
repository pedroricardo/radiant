import Image from "next/image"

import favicon from "../../../public/favicon.svg"
import radioStationSvg from "../../assets/icons/radio-station.svg"
import settingsSvg from "../../assets/icons/settings.svg"
import { groteskFont } from "../../lib/fonts"

type DashboardSidebarProps = {
	user: {
		username: string
		avatarUrl?: string | null
	}
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
	return (
		<aside className="flex flex-col justify-between border-r-3 border-neo-black">
			<div>
				<div className="flex flex-col items-stretch">
					<div className="flex h-[4.1rem] items-center justify-center border-b-3 border-neo-black bg-signal-warm">
						<Image src={radioStationSvg} alt="Radios" className="h-7 w-7" draggable={false} />
					</div>

					<div className="flex h-[4.1rem] items-center justify-center bg-white">
						<Image src={settingsSvg} alt="Settings" className="h-7 w-7" draggable={false} />
					</div>
				</div>
			</div>

			<div className="flex justify-center border-t-3 p-2.5">
				<div className="mr-0.5 mb-0.5 flex h-10 w-10 items-center justify-center overflow-hidden border-3 border-neo-black bg-white shadow-neo-badge">
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt={user.username}
							draggable={false}
							className="h-full w-full object-cover"
						/>
					) : (
						<div
							className={`flex h-full w-full items-center justify-center text-sm font-extrabold ${groteskFont.className}`}
						>
							{user.username.slice(0, 1).toUpperCase()}
						</div>
					)}
				</div>
			</div>
		</aside>
	)
}
