import type { Metadata } from "next"
import "./globals.css"
import { groteskFont } from "./lib/fonts"

export const metadata: Metadata = {
	title: "Radiant",
	description: "Faz o teu som",
	icons: "/favicon.svg",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en" className={`${groteskFont.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	)
}
