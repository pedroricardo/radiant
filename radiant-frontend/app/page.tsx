"use server";

import { Black_Ops_One, Space_Grotesk, Tomorrow } from "next/font/google"
import { PropsWithChildren } from "react"
import {RadiantClient} from "@radiant/client"
import {Effect, Option} from "effect"
import { runEffect } from "./lib/serverApiClient";
const display = Black_Ops_One({
	weight: "400",
	subsets: ["latin"]
})

const grotesk = Space_Grotesk({
	weight: ["500", "700"],
	subsets: ["latin"]
})

const tomorrow = Tomorrow({
	weight: ["400", "700", "800"],
	subsets: ["latin"]
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
async function LoginButton() {
	const user = await getUser();
	return Option.match(user, {
		onSome: (user) => <>{user.username}</>,
		onNone: () => <>Não logado</>
	})
}

async function Layout(props: PropsWithChildren) {
	return <>
		<nav>
			<div className="container mx-auto">
				<h1 className={`${grotesk.className} text-lg font-bold`}>Radiant</h1>
				<LoginButton/>
			</div>
		</nav>
		{props.children}
	</>
}

export default async function Home() {

	return (<Layout>
			<main>

		</main>
	</Layout>)
}
