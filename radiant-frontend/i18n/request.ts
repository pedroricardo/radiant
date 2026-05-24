import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { defaultLocale, isLocale, localeCookieName } from "../app/lib/i18n"

export default getRequestConfig(async () => {
	const cookieStore = await cookies()
	const requestedLocale = cookieStore.get(localeCookieName)?.value
	const locale = requestedLocale && isLocale(requestedLocale) ? requestedLocale : defaultLocale

	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
	}
})
