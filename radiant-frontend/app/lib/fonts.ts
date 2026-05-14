import { Black_Ops_One, Space_Grotesk, Tomorrow } from "next/font/google"

export const displayFont = Black_Ops_One({
	weight: "400",
	subsets: ["latin"],
})

export const groteskFont = Space_Grotesk({
	weight: "variable",
	subsets: ["latin"],
	variable: "--font-grotesk",
})

export const tomorrowFont = Tomorrow({
	weight: ["400", "700", "800"],
	subsets: ["latin"],
	variable: "--font-tomorrow",
})
