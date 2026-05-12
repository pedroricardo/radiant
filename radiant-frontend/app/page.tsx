"use server";

import { Black_Ops_One, Space_Grotesk, Tomorrow } from "next/font/google"
import { PropsWithChildren } from "react"
import {RadiantClient} from "@radiant/client"
import {Effect, Option} from "effect"
import { runEffect } from "./lib/serverApiClient";
import waveIcon from "./assets/logo-wave.svg"
import Image from "next/image";
const display = Black_Ops_One({
	weight: "400",
	subsets: ["latin"]
})

const grotesk = Space_Grotesk({
	weight: "variable",
	subsets: ["latin"]
})

const tomorrow = Tomorrow({
	weight: ["400", "700", "800"],
	subsets: ["latin"],
})
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
	return <a href="/login" draggable={false} className={`border-3 border-black bg-blue-300 text-black! active:border-transparent active:rounded-sm not-active:shadow-neo-badge active:translate-1 transition-all p-2 ${grotesk.className} font-bold tracking-tighter cursor-pointer`}>Streamar agora</a>
}

function RadiantLogo() {
	return <h1 className={`${tomorrow.className} text-lg font-bold tracking-tighter relative`}>Radiant <Image alt="logo wave icon" className="w-3 absolute -right-2.5 top-0.5" src={waveIcon}/></h1>
}

async function Layout(props: PropsWithChildren) {
	const user = await getUser();
	return <div className="container mx-auto">
		<nav className="bg-white m-3 shadow-neo-panel border-3 border-neo-black select-none">
			<div className="flex justify-between items-center py-4 px-6 text-neo-black">
				<RadiantLogo />
				{Option.match(user, {
					onSome: (user) => <div className={`text-sm flex items-center gap-4 ${grotesk.className} tracking-tight font-bold`}><img src={user.avatarUrl} className="h-7 border-3 border-neo-black shadow-neo-badge shadow-neo-paper"/>{user.username}</div>,
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

		</main>
	</Layout>)
}
