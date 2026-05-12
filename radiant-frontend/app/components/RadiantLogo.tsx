import Image from "next/image"

import waveIcon from "../assets/logo-wave.svg"
import { tomorrowFont } from "../lib/fonts"

export function RadiantLogo() {
	return (
		<h1 className={`${tomorrowFont.className} relative text-3xl font-bold tracking-tighter`}>
			Radiant
			<Image alt="logo wave icon" className="absolute -top-0.5 -right-4 w-4" src={waveIcon} />
		</h1>
	)
}
