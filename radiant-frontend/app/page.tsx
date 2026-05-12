"use server";

import { PropsWithChildren } from "react"
import {RadiantClient} from "@radiant/client"
import {Effect, Option} from "effect"
import { runEffect } from "./lib/serverApiClient";
import waveIcon from "./assets/logo-wave.svg"
import matsuriCover from "./assets/まつり-foto.png"
import Image from "next/image";
import { groteskFont, tomorrowFont } from "./lib/fonts";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { HeroCopy } from "./components/home/HeroCopy";
import { FeatureStatsRow } from "./components/home/FeatureStatsRow";
import { PreviewCard } from "./components/home/PreviewCard";
import { ScheduleWindowCard } from "./components/home/ScheduleWindowCard";
import { StreamHealthCard } from "./components/home/StreamHealthCard";
async function getUser() {
	// Este runEffect é especial
	// Ele injeta um RadiantClient com um FetchHttpClient falso que invês de usar o fetch, ele chama o
	// webHandler diretamente, assim ele consegue fazer requesições pro backend sem roundtrips por TCP ou pela rede
	// Ele apenas simplesmente chama uma função com um Request e recebe um Response de volta e o HttpClient trata de converter
	// o Response em algo que nós entendemos aqui
	return runEffect(Effect.gen(function* () {
		const client = yield* RadiantClient;
		return yield* client.users.getSelf().pipe(
			Effect.asSome,
			Effect.catchTag("Unauthorized", () => Effect.succeed(Option.none())),
		)
	}))
}
function LoginButton() {
	return <Button asChild variant="secondary" className="cursor-pointer"><a href="/login" draggable={false}>Stream now</a></Button>
}

function RadiantLogo() {
	return <h1 className={`${tomorrowFont.className} text-3xl font-bold tracking-tighter relative`}>Radiant <Image alt="logo wave icon" className="w-4 absolute -right-4 -top-0.5" src={waveIcon}/></h1>
}

async function Layout(props: PropsWithChildren) {
	const user = await getUser();
	return <div className="container mx-auto">
		<nav className="bg-white m-3 shadow-neo-panel border-3 border-neo-black select-none">
			<div className="flex justify-between items-center py-4 px-6 text-neo-black">
				<div className="flex gap-7 items-center">
					<RadiantLogo /> <Badge variant="mint">BETA</Badge>
				</div>
				{Option.match(user, {
					onSome: (user) => <div className={`text-sm flex items-center gap-4 ${groteskFont.className} tracking-tight font-bold`}><img src={user.avatarUrl} className="h-7 border-3 border-neo-black shadow-neo-badge shadow-neo-paper"/>{user.username}</div>,
					onNone: () => <LoginButton/>
				})}
			</div>
		</nav>
		{props.children}
	</div>
}
export default async function Home() {

	return (<Layout>
			<main className="shadow-neo-panel bg-white m-3 mt-6 border-neo-black border-3 min-h-screen">
				<section className="flex min-h-[90vh] flex-col 2xl:grid 2xl:grid-cols-2">
					<div className="border-b-3 border-neo-black p-6 text-neo-black sm:p-8 2xl:flex 2xl:flex-col 2xl:justify-center 2xl:border-b-0 2xl:border-r-3 2xl:p-12">
						<HeroCopy />
					</div>

					<div className="gap-0 bg-blue-50/70 p-4 sm:p-6 flex flex-col justify-center">
						<PreviewCard cover={matsuriCover} />
						<FeatureStatsRow className="mt-4" />
					</div>
				</section>
		</main>
	</Layout>)
}
