import * as DateTime from "effect/DateTime"
import { Option, ParseResult, Schema } from "effect"

export const TimeFromSelf = Schema.Struct({
	hours: Schema.Int.pipe(Schema.between(0, 23)),
	minutes: Schema.Int.pipe(Schema.between(0, 59)),
})
export type Time = typeof TimeFromSelf.Type

export const Time = Schema.transformOrFail(Schema.String, TimeFromSelf, {
	strict: true,
	decode: (value, _, ast) => {
		const match = /^(\d{2}):(\d{2})$/.exec(value.trim())

		if (match == null) {
			return ParseResult.fail(new ParseResult.Type(ast, value, "Use HH:mm in 24-hour format."))
		}

		const hours = Number(match[1])
		const minutes = Number(match[2])

		if (
			!Number.isInteger(hours) ||
			!Number.isInteger(minutes) ||
			hours < 0 ||
			hours > 23 ||
			minutes < 0 ||
			minutes > 59
		) {
			return ParseResult.fail(new ParseResult.Type(ast, value, "Use HH:mm in 24-hour format."))
		}

		return ParseResult.succeed({ hours, minutes })
	},
	encode: (time) =>
		ParseResult.succeed(
			`${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`,
		),
})

export const parseTime = (value: string): Time | null => {
	const parsed = Schema.decodeUnknownOption(Time)(value.trim())

	return Option.isSome(parsed) ? parsed.value : null
}

export const toMinuteOfDay = (time: Time): number => time.hours * 60 + time.minutes

export const parseMinuteOfDay = (value: string): number | null => {
	const parsed = parseTime(value)

	return parsed == null ? null : toMinuteOfDay(parsed)
}

export const timeFromMinuteOfDay = (minuteOfDay: number): Time | null => {
	if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 23 * 60 + 59) {
		return null
	}

	return {
		hours: Math.floor(minuteOfDay / 60),
		minutes: minuteOfDay % 60,
	}
}

export const parseIsoLocalDate = (value: string) => {
	const parsed = Schema.decodeUnknownOption(Schema.DateTimeUtc)(value.trim())

	if (Option.isNone(parsed)) {
		return null
	}

	const parts = DateTime.toPartsUtc(parsed.value)

	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
	}
}

export const makeZonedDateTime = (
	parts: { year: number; month: number; day: number },
	minuteOfDay: number,
	timeZone: string,
) =>
	DateTime.unsafeMakeZoned(
		{
			year: parts.year,
			month: parts.month,
			day: parts.day,
			hours: Math.floor(minuteOfDay / 60),
			minutes: minuteOfDay % 60,
			seconds: 0,
			millis: 0,
		},
		{
			timeZone,
			adjustForTimeZone: true,
			disambiguation: "compatible",
		},
	)
