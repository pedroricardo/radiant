import { Cause, Logger } from "effect"

import * as clack from "@clack/prompts"

const renderMessagePart = (message: unknown): string => {
	if (typeof message === "string") return message
	if (typeof message === "number" || typeof message === "boolean" || typeof message === "bigint") {
		return String(message)
	}
	if (message == null) return String(message)
	if (Array.isArray(message)) {
		return message.map(renderMessagePart).join(" ")
	}

	try {
		return JSON.stringify(message)
	} catch {
		return String(message)
	}
}

const renderAnnotations = (annotations: Logger.Logger.Options<unknown>["annotations"]): string => {
	const rendered = Array.from(annotations).map(
		([key, value]) => `${key}=${renderMessagePart(value)}`,
	)

	return rendered.length > 0 ? ` {${rendered.join(" ")}}` : ""
}

const renderCause = (cause: Logger.Logger.Options<unknown>["cause"]): string => {
	return Cause.isEmpty(cause) ? "" : `\n${Cause.pretty(cause)}`
}

export const clackLogger = Logger.make((options) => {
	const entry = `${renderMessagePart(options.message)}${renderAnnotations(options.annotations)}${renderCause(options.cause)}`

	switch (options.logLevel._tag) {
		case "Fatal":
		case "Error":
			clack.log.error(entry)
			return
		case "Warning":
			clack.log.warn(entry)
			return
		case "Info":
			clack.log.info(entry)
			return
		case "Debug":
		case "Trace":
			clack.log.message(entry)
			return
		default:
			clack.log.step(entry)
			return
	}
})

export const clackLoggerLayer = Logger.replace(Logger.defaultLogger, clackLogger)
