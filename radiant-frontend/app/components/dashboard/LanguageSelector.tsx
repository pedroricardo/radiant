"use client"

import { useAtom, useAtomSet } from "@effect-atom/atom-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { startTransition } from "react"

import { localeAtom } from "../../lib/atoms/localeAtom"
import { locales, type AppLocale } from "../../lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select"

export function LanguageSelector() {
	const router = useRouter()
	const localeFromIntl = useLocale() as AppLocale
	const t = useTranslations("language")
	const [locale] = useAtom(localeAtom)
	const setLocale = useAtomSet(localeAtom)

	return (
		<Select
			value={locale ?? localeFromIntl}
			onValueChange={(nextLocale) => {
				setLocale(nextLocale as AppLocale)
				startTransition(() => {
					router.refresh()
				})
			}}
		>
			<SelectTrigger aria-label={t("label")} className="h-10 w-32 bg-neo-paper px-3 py-2 text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{locales.map((locale) => (
					<SelectItem key={locale} value={locale}>
						{t(locale)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
