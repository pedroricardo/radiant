"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import radioStationSvg from "../../assets/icons/radio-station.svg"
import settingsSvg from "../../assets/icons/settings.svg"
import { useOptionalCurrentUser } from "../../lib/atoms/currentUser"
import { groteskFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

export function DashboardSidebar() {
	const pathname = usePathname()
	const currentUser = useOptionalCurrentUser()

	const navItems = [
		{
			href: "/dashboard",
			label: "Radios",
			icon: radioStationSvg,
			isActive: pathname === "/dashboard" || pathname.startsWith("/dashboard/radios/"),
		},
		{
			href: "/dashboard/settings",
			label: "Settings",
			icon: settingsSvg,
			isActive: pathname === "/dashboard/settings",
		},
	] as const

	return (
		<aside className="flex flex-col justify-between border-r-3 border-neo-black">
			<div>
				<nav className="flex flex-col items-stretch" aria-label="Dashboard navigation">
					{navItems.map((item, index) => (
						<Link
							key={item.href}
							href={item.href}
							aria-current={item.isActive ? "page" : undefined}
							className={cn(
								"flex h-[4.1rem] items-center justify-center transition-colors",
								index === 0 && "border-b-3 border-neo-black",
								item.isActive ? "bg-signal-warm" : "bg-white hover:bg-blue-50",
							)}
							title={item.label}
						>
							<Image src={item.icon} alt={item.label} className="h-7 w-7" draggable={false} />
						</Link>
					))}
				</nav>
			</div>

			<div className="flex justify-center border-t-3 p-2.5">
				<div className="mr-0.5 mb-0.5 flex h-10 w-10 items-center justify-center overflow-hidden border-3 border-neo-black bg-white shadow-neo-badge">
					{currentUser._tag === "Some" && currentUser.value.avatarUrl ? (
						<img
							src={currentUser.value.avatarUrl}
							alt={currentUser.value.username}
							draggable={false}
							className="h-full w-full object-cover"
						/>
					) : (
						<div
							className={`flex h-full w-full items-center justify-center text-sm font-extrabold ${groteskFont.className}`}
						>
							{currentUser._tag === "Some" ? currentUser.value.username.slice(0, 1).toUpperCase() : "?"}
						</div>
					)}
				</div>
			</div>
		</aside>
	)
}
