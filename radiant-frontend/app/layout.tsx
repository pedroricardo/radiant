import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import "./globals.css"
import { RadiantAtomsProvider } from "./lib/atoms/RadiantAtomsProvider"
import { groteskFont } from "./lib/fonts"
import { isLocale } from "./lib/i18n"

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
	const [locale, messages] = await Promise.all([
		getLocale(),
		getMessages(),
	])
	const appLocale = isLocale(locale) ? locale : "pt"

	return (
		<html lang={appLocale} className={`${groteskFont.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col">
				<NextIntlClientProvider locale={appLocale} messages={messages}>
					<RadiantAtomsProvider locale={appLocale}>
						{children}
					</RadiantAtomsProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	)
}
