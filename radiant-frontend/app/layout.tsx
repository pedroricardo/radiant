import type { Metadata } from "next"
import "./globals.css"
import { getCurrentUser } from "./lib/auth"
import { RadiantAtomsProvider } from "./lib/atoms/RadiantAtomsProvider"
import { groteskFont } from "./lib/fonts"
import { User } from "@radiant/client"
import { Schema, Option } from "effect"

export const metadata: Metadata = {
	title: "Radiant",
	description: "Faz o teu som",
	icons: "/favicon.svg",
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const currentUser = await getCurrentUser()

	return (
		<html lang="en" className={`${groteskFont.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col">
				<RadiantAtomsProvider currentUser={Schema.encodeSync(Schema.NullOr(User.User))(Option.getOrNull(currentUser))}>{children}</RadiantAtomsProvider>
			</body>
		</html>
	)
}
