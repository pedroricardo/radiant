import { useTranslations } from "next-intl"

import { displayFont, groteskFont } from "../../lib/fonts"
import { Button } from "../ui/Button"

export function HeroCopy(props: { ctaHref?: string }) {
	const t = useTranslations("home.hero")

	return (
		<div>
			<h2
				className={`${displayFont.className} max-w-[8ch] text-[4.2rem] leading-[0.88] text-neo-black sm:text-[5.6rem] lg:text-[7.4rem]`}
			>
				{t("title")}
			</h2>

			<p
				className={`${groteskFont.className} mt-6 max-w-[34rem] text-lg leading-8 text-black/75 sm:text-xl`}
			>
				{t("line1")}
				<br />
				{t("line2")}
			</p>

			<div className="mt-8 flex flex-wrap gap-4">
				<Button asChild>
					<a href={props.ctaHref ?? "/login"} draggable={false}>
						{t("cta")}
					</a>
				</Button>
			</div>
		</div>
	)
}
