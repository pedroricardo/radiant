export const localeCookieName = "radiant-locale"

export const locales = ["pt", "en"] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "pt"

export function isLocale(value: string): value is AppLocale {
	return locales.includes(value as AppLocale)
}
