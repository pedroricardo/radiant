"use client"

import { Atom, Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Cause } from "effect"
import { useTranslations } from "next-intl"

import { Radio } from "@radiant/client"
import { radioListAtom } from "../../lib/atoms/radiantClient"
import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { CreateRadioDialog } from "./CreateRadioDialog"
import { RadioTile } from "./RadioTile"

type DashboardRadioPickerProps = {
	initialRadios: ReadonlyArray<typeof Radio.RadioInfo.Type>
}

export function DashboardRadioPicker({ initialRadios }: DashboardRadioPickerProps) {
	const radios = useAtomValue(radioListAtom)
	const radioList = Result.getOrElse(radios, () => initialRadios)
	const refreshRadios = useAtomRefresh(radioListAtom)
	const t = useTranslations("dashboardPicker")

	return (
		<div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-6 py-10">
			<div className="flex flex-col items-center gap-4 text-center">
				<Badge variant="orange">{t("badge")}</Badge>

				<h1
					className={`select-none text-center text-4xl tracking-tight text-neo-black sm:text-5xl ${tomorrowFont.className}`}
				>
					{t("title")}
				</h1>

				<p
					className={`max-w-xl select-none text-sm font-bold tracking-tight text-black/65 sm:text-base ${groteskFont.className}`}
				>
					{t("description")}
				</p>
			</div>

			{radioList.length > 0 ? (
				<div className="mt-10">
					<CreateRadioDialog trigger={<Button variant="default">{t("createRadio")}</Button>} />
				</div>
			) : null}

			<div className="mt-12 flex flex-wrap items-start justify-center gap-8">
				{radioList.map((radio) => (
					<RadioTile key={radio.id} id={radio.id} name={radio.name} />
				))}
			</div>

			{radioList.length === 0 ? (
				<div className="mt-12 flex flex-col items-center gap-4 border-3 border-neo-black bg-neo-paper px-6 py-6 shadow-neo-badge">
					<p className={`select-none text-center text-base text-black/70 ${groteskFont.className}`}>
						{t("empty")}
					</p>

					<CreateRadioDialog trigger={<Button variant="default">{t("createRadio")}</Button>} />
				</div>
			) : null}
		</div>
	)
}
