import { RadiantClient } from "@radiant/client"
import { Option } from "effect"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { redirect } from "next/navigation"

import discordIcon from "../assets/Discord-Symbol-Black.svg"
import githubIcon from "../assets/GitHub_Invertocat_Black.svg"
import { RadiantLogo } from "../components/RadiantLogo"
import { Badge } from "../components/ui/Badge"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { getCurrentUser } from "../lib/auth"
import { displayFont, groteskFont, tomorrowFont } from "../lib/fonts"
import { runServerEffect } from "../lib/serverApiClient"

const providerMeta = {
	github: {
		className: "bg-neo-paper !text-neo-black",
		icon: githubIcon,
	},
	discord: {
		className: "bg-[#5865F2] !text-white",
		icon: discordIcon,
	},
} as const satisfies Record<string, { className: string; icon: typeof githubIcon }>

function getOAuthProviders() {
	return RadiantClient.use((client) => client.auth.listOAuthProviders())
}

export default async function LoginPage() {
	const [currentUser, providers] = await Promise.all([getCurrentUser(), runServerEffect(getOAuthProviders())])
	const t = await getTranslations("login")
	if (Option.isSome(currentUser)) {
		redirect("/dashboard")
	}

	return (
		<main className="min-h-screen bg-blue-50 px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
				<Card className="w-full max-w-xl bg-white shadow-neo-panel">
					<div className="flex items-center gap-7 border-b-3 border-neo-black px-6 py-4 text-neo-black sm:px-8">
						<RadiantLogo />
						<Badge variant="mint">BETA</Badge>
					</div>
					<CardHeader className="p-6 sm:p-8">
						<p
							className={`text-[10px] font-extrabold uppercase tracking-[0.26em] text-black/55 ${groteskFont.className}`}
						>
							{t("kicker")}
						</p>
						<CardTitle
							className={`${displayFont.className} mt-3 max-w-[7ch] text-[3.25rem] leading-[0.9] text-neo-black sm:text-[4.25rem]`}
						>
							{t("title")}
						</CardTitle>
						<CardDescription
							className={`${groteskFont.className} mt-4 max-w-[34rem] text-base leading-7 text-black/75 sm:text-lg`}
						>
							{t("description")}
						</CardDescription>
					</CardHeader>

					<CardContent className="border-t-3 border-neo-black p-6 sm:p-8">
						<div className="flex flex-col gap-4">
							{providers.length === 0 ? (
								<div className="border-3 border-neo-black bg-neo-paper p-5 shadow-neo-badge">
									<p
										className={`${tomorrowFont.className} text-sm font-extrabold uppercase text-neo-black`}
									>
										{t("noProvidersTitle")}
									</p>
									<p className={`${groteskFont.className} mt-2 text-sm leading-6 text-black/70`}>
										{t("noProvidersDescription")}
									</p>
								</div>
							) : (
								providers.map((provider) => {
									const meta = providerMeta[provider as keyof typeof providerMeta] ?? {
										className: "bg-neo-paper !text-neo-black",
										icon: null,
									}

									return (
										<Button
											key={provider}
											asChild
											variant="secondary"
											size="lg"
											className={`w-full justify-start ${meta.className}`}
										>
											<a href={`/auth/oauth/${encodeURIComponent(provider)}`} draggable={false}>
												<span className="mr-3 inline-flex h-8 w-8 items-center justify-center">
													{meta.icon == null ? (
														<span className="text-[10px] font-black">?</span>
													) : (
														<Image src={meta.icon} alt="" aria-hidden="true" className="h-5 w-5" />
													)}
												</span>
												{provider === "github"
													? t("continueWithGithub")
													: provider === "discord"
														? t("continueWithDiscord")
														: t("continueWithProvider", { provider })}
											</a>
										</Button>
									)
								})
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
