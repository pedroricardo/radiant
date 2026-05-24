import { getTranslations } from "next-intl/server"

import { groteskFont, tomorrowFont } from "../../../../lib/fonts"

type RadioSettingsPageProps = {
	params: Promise<{
		radioId: string
	}>
}

export default async function RadioSettingsPage({ params }: RadioSettingsPageProps) {
	const { radioId } = await params
	const t = await getTranslations("radioSettings")

	return (
		<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-10">
			<div className="border-3 border-neo-black bg-neo-paper p-6 shadow-neo-panel">
				<p className={`text-xs font-extrabold uppercase tracking-widest text-black/55 ${groteskFont.className}`}>
					{t("kicker")}
				</p>
				<h1 className={`mt-3 text-4xl tracking-tight text-neo-black ${tomorrowFont.className}`}>
					{t("title", { radioId })}
				</h1>
				<p className={`mt-4 max-w-2xl text-sm leading-7 text-black/70 ${groteskFont.className}`}>
					{t("description")}
				</p>
			</div>
		</div>
	)
}
