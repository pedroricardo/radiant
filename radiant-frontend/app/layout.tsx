import type { Metadata } from "next"
import { AppRuntimeProvider } from "./lib/effect-runtime/AppRuntimeProvider"
import { groteskFont } from "./lib/fonts"
import "./globals.css"

export const metadata: Metadata = {
  title: "Radiant",
  description: "Faz o teu som",
	icons: "/favicon.svg"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${groteskFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
				<AppRuntimeProvider>{children}</AppRuntimeProvider>
			</body>
    </html>
  )
}
