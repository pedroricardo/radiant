import { groteskFont, tomorrowFont } from "../../lib/fonts"

export default function DashboardSettingsPage() {
	return (
		<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-10">
			<div className="border-3 border-neo-black bg-neo-paper p-6 shadow-neo-panel">
				<p className={`text-xs font-extrabold uppercase tracking-[0.22em] text-black/55 ${groteskFont.className}`}>
					Settings
				</p>
				<h1 className={`mt-3 text-4xl tracking-tight text-neo-black ${tomorrowFont.className}`}>
					Workspace settings
				</h1>
				<p className={`mt-4 max-w-2xl text-sm leading-7 text-black/70 ${groteskFont.className}`}>
					Esta area vai concentrar configuracao da conta, preferencias do dashboard e opcoes da estacao.
				</p>
				</div>
		</div>
	)
}
