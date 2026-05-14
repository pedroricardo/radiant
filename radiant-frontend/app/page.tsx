"use server"

import { Option } from "effect"
import { PropsWithChildren } from "react"
import matsuriCover from "./assets/まつり-foto.png"
import { RadiantLogo } from "./components/RadiantLogo"
import { PreviewCard } from "./components/design-system/PreviewCard"
import { FeatureStatsRow } from "./components/home/FeatureStatsRow"
import { HeroCopy } from "./components/home/HeroCopy"
import { Badge } from "./components/ui/Badge"
import { Button } from "./components/ui/Button"
import { getCurrentUser } from "./lib/auth"
import { groteskFont } from "./lib/fonts"
import { runServerEffect } from "./lib/serverApiClient"

function LoginButton() {
	return (
		<Button asChild variant="secondary" className="cursor-pointer">
			<a href="/login" draggable={false}>
				Stream now
			</a>
		</Button>
	)
}

async function Layout(props: PropsWithChildren) {
	const user = await runServerEffect(getCurrentUser())
	return (
		<div className="container mx-auto">
			<nav className="bg-white m-3 shadow-neo-panel border-3 border-neo-black select-none">
				<div className="flex justify-between items-center py-4 px-6 text-neo-black">
					<div className="flex gap-7 items-center">
						<RadiantLogo /> <Badge variant="mint">BETA</Badge>
					</div>
					{Option.match(user, {
						onSome: (user) => (
							<div
								className={`text-sm flex items-center gap-4 ${groteskFont.className} tracking-tight font-bold`}
							>
								<img
									src={user.avatarUrl}
									className="h-7 border-3 border-neo-black shadow-neo-badge shadow-neo-paper"
								/>
								{user.username}
							</div>
						),
						onNone: () => <LoginButton />,
					})}
				</div>
			</nav>
			{props.children}
		</div>
	)
}
export default async function Home() {
	const user = await runServerEffect(getCurrentUser())

	return (
		<Layout>
			<main className="shadow-neo-panel bg-white m-3 mt-6 border-neo-black border-3 min-h-screen">
				<section className="flex min-h-[90vh] flex-col 2xl:grid 2xl:grid-cols-2">
					<div className="border-b-3 border-neo-black p-6 text-neo-black sm:p-8 2xl:flex 2xl:flex-col 2xl:justify-center 2xl:border-b-0 2xl:border-r-3 2xl:p-12">
						<HeroCopy ctaHref={Option.isSome(user) ? "/dashboard" : "/login"} />
					</div>

					<div className="gap-0 bg-blue-50/70 p-4 sm:p-6 flex flex-col justify-center">
						<PreviewCard
							cover={matsuriCover}
							coverAlt="Matsuri cover art"
							title="Matsuri"
							artist="Fujii Kaze"
							playlistName="Sunset Rotation / Festival Cuts"
							endsAt="18:24"
							nextTrackLabel="Lamp - 恋人へ / Koibito e"
							defaultVolume={72}
							defaultMuted={false}
							isLive
						/>
						<FeatureStatsRow className="mt-4" />
					</div>
				</section>
			</main>
		</Layout>
	)
}
