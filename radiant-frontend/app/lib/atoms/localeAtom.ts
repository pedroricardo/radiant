"use client"

import { Atom } from "@effect-atom/atom-react"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import { Schema } from "effect"

import { defaultLocale, localeCookieName, type AppLocale } from "../i18n"

type CookieStorage = Storage & {
	keys(): Array<string>
}

const cookieStorage: CookieStorage = {
	get length() {
		return document.cookie
			.split(";")
			.map((part) => part.trim())
			.filter((part) => part.length > 0).length
	},
	clear() {
		for (const key of this.keys()) {
			this.removeItem(key)
		}
	},
	getItem(key) {
		const prefix = `${encodeURIComponent(key)}=`
		for (const part of document.cookie.split(";")) {
			const trimmed = part.trim()
			if (trimmed.startsWith(prefix)) {
				return decodeURIComponent(trimmed.slice(prefix.length))
			}
		}
		return null
	},
	key(index) {
		return this.keys()[index] ?? null
	},
	removeItem(key) {
		document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; samesite=lax`
	},
	setItem(key, value) {
		document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
	},
	keys() {
		return document.cookie
			.split(";")
			.map((part) => part.trim().split("=")[0])
			.filter((part) => part.length > 0)
			.map((part) => decodeURIComponent(part))
	},
}

const localeRuntime = Atom.runtime(KeyValueStore.layerStorage(() => cookieStorage))

export const localeAtom = Atom.kvs<AppLocale>({
	runtime: localeRuntime,
	key: localeCookieName,
	schema: Schema.Literal("pt", "en"),
	defaultValue: () => defaultLocale,
})
