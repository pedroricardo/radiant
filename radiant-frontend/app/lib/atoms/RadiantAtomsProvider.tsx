"use client"

import { RegistryProvider } from "@effect-atom/atom-react"
import type { ReactNode } from "react"

import { localeAtom } from "./localeAtom"
import type { AppLocale } from "../i18n"

type RadiantAtomsProviderProps = {
	locale: AppLocale
	children: ReactNode
}

export function RadiantAtomsProvider({ locale, children }: RadiantAtomsProviderProps) {
	return (
		<RegistryProvider
			initialValues={[
				[localeAtom, locale],
			]}
		>
			{children}
		</RegistryProvider>
	)
}
