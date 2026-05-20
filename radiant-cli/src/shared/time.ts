import { Duration, Effect, Option, ParseResult, Schema } from "effect"
import * as DateTime from "effect/DateTime"

export const TimeFromSelf = Schema.Struct({
	hours: Schema.Int.pipe(Schema.between(0, 23)),
	minutes: Schema.Int.pipe(Schema.between(0, 59)),
})
export type Time = typeof TimeFromSelf.Type

export const Time: Schema.Schema<Time, string, never> = Schema.transformOrFail(
	Schema.String,
	TimeFromSelf,
	{
		strict: true,
		decode: (value, _options, ast) =>
			Effect.gen(function* () {
				const match = /^(\d{2}):(\d{2})$/.exec(value.trim())

				if (match == null) {
					return yield* Effect.fail(
						new ParseResult.Type(ast, value, "Use HH:mm in 24-hour format."),
					)
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
					return yield* Effect.fail(
						new ParseResult.Type(ast, value, "Use HH:mm in 24-hour format."),
					)
				}

				return { hours, minutes }
			}),
		encode: (time) =>
			Effect.succeed(
				`${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`,
			),
	},
)

export const LocalDateFromSelf = Schema.Struct({
	year: Schema.Int,
	month: Schema.Int.pipe(Schema.between(1, 12)),
	day: Schema.Int.pipe(Schema.between(1, 31)),
})
export type LocalDate = typeof LocalDateFromSelf.Type

export const formatLocalDate = (parts: LocalDate) =>
	`${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`

export const LocalDate: Schema.Schema<LocalDate, string, never> = Schema.transformOrFail(
	Schema.String,
	LocalDateFromSelf,
	{
		strict: true,
		decode: (value) =>
			Schema.decodeUnknown(Schema.DateTimeUtc)(value.trim()).pipe(
				Effect.map((dateTime) => {
					const parts = DateTime.toPartsUtc(dateTime)
					return {
						year: parts.year,
						month: parts.month,
						day: parts.day,
					}
				}),
				Effect.mapError(() => new ParseResult.Type(Schema.String.ast, value, "Use YYYY-MM-DD.")),
			),
		encode: (parts) => Effect.succeed(formatLocalDate(parts)),
	},
)

export const RelativeDuration: Schema.Schema<Duration.Duration, string, never> =
	Schema.transformOrFail(Schema.String, Schema.DurationFromSelf, {
		strict: true,
		decode: (value, _options, ast) =>
			Effect.gen(function* () {
				const trimmed = value.trim()

				if (!trimmed.startsWith("+")) {
					return yield* Effect.fail(
						new ParseResult.Type(ast, value, "Use a relative offset like +00:01, +1m, +30s."),
					)
				}

				const hhmm = /^(\d{2}):(\d{2})$/.exec(trimmed.slice(1))
				if (hhmm != null) {
					const hours = Number(hhmm[1])
					const minutes = Number(hhmm[2])

					if (
						Number.isInteger(hours) &&
						Number.isInteger(minutes) &&
						hours >= 0 &&
						minutes >= 0 &&
						minutes <= 59
					) {
						return Duration.millis(hours * 60 * 60 * 1000 + minutes * 60 * 1000)
					}
				}

				const matches = [...trimmed.slice(1).matchAll(/(\d+)(h|m|s)/g)]
				if (
					matches.length === 0 ||
					matches.map((match) => match[0]).join("") !== trimmed.slice(1)
				) {
					return yield* Effect.fail(
						new ParseResult.Type(ast, value, "Use a relative offset like +00:01, +1m, +30s."),
					)
				}

				let totalMs = 0
				for (const match of matches) {
					const amount = Number(match[1])
					const unit = match[2]

					if (!Number.isInteger(amount) || amount < 0) {
						return yield* Effect.fail(
							new ParseResult.Type(ast, value, "Use a relative offset like +00:01, +1m, +30s."),
						)
					}

					if (unit === "h") {
						totalMs += amount * 60 * 60 * 1000
					} else if (unit === "m") {
						totalMs += amount * 60 * 1000
					} else if (unit === "s") {
						totalMs += amount * 1000
					}
				}

				return Duration.millis(totalMs)
			}),
		encode: (_duration, _options, ast) =>
			Effect.fail(new ParseResult.Forbidden(ast, "Encoding relative durations is not supported.")),
	})

export const toMinuteOfDay = (time: Time): number => time.hours * 60 + time.minutes

export const zonedDateParts = (dateTime: DateTime.Zoned): LocalDate => {
	const parts = DateTime.toParts(dateTime)
	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
	}
}

export const makeZonedDateTime = (parts: LocalDate, minuteOfDay: number, timeZone: string) =>
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

export const OneOffStartInput: Schema.Schema<
	{ date: LocalDate; startMinuteOfDay: number; startsAt: DateTime.Zoned },
	{ timeZone: string; dateInput: string; startInput: string },
	never
> = Schema.transformOrFail(
	Schema.Struct({
		timeZone: Schema.String,
		dateInput: Schema.String,
		startInput: Schema.String,
	}),
	Schema.Struct({
		date: LocalDateFromSelf,
		startMinuteOfDay: Schema.Int.pipe(Schema.between(0, 23 * 60 + 59)),
		startsAt: Schema.DateTimeZonedFromSelf,
	}),
	{
		strict: true,
		decode: ({ timeZone, dateInput, startInput }, _options, ast) =>
			Effect.gen(function* () {
				const parsedDate = Schema.decodeUnknownOption(LocalDate)(dateInput)
				if (Option.isNone(parsedDate)) {
					return yield* Effect.fail(new ParseResult.Type(ast, dateInput, "Use YYYY-MM-DD."))
				}

				if (startInput.startsWith("+")) {
					const parsedRelativeDuration = Schema.decodeUnknownOption(RelativeDuration)(startInput)
					if (Option.isNone(parsedRelativeDuration)) {
						return yield* Effect.fail(
							new ParseResult.Type(
								ast,
								startInput,
								"Use HH:mm or a relative offset like +00:01, +1m, +30s.",
							),
						)
					}

					const now = yield* DateTime.now
					const futureUtc = DateTime.addDuration(now, parsedRelativeDuration.value)
					const startDateTime = DateTime.setZone(futureUtc, DateTime.zoneUnsafeMakeNamed(timeZone))
					const parts = DateTime.toParts(startDateTime)
					return {
						date: zonedDateParts(startDateTime),
						startMinuteOfDay: toMinuteOfDay({
							hours: parts.hours,
							minutes: parts.minutes,
						}),
						startsAt: startDateTime,
					}
				}

				const parsedTime = Schema.decodeUnknownOption(Time)(startInput)
				if (Option.isNone(parsedTime)) {
					return yield* Effect.fail(
						new ParseResult.Type(
							ast,
							startInput,
							"Use HH:mm or a relative offset like +00:01, +1m, +30s.",
						),
					)
				}

				return {
					date: parsedDate.value,
					startMinuteOfDay: toMinuteOfDay(parsedTime.value),
					startsAt: makeZonedDateTime(parsedDate.value, toMinuteOfDay(parsedTime.value), timeZone),
				}
			}),
		encode: ({ date, startMinuteOfDay }) =>
			Effect.succeed({
				timeZone: "UTC",
				dateInput: formatLocalDate(date),
				startInput: `${String(Math.floor(startMinuteOfDay / 60)).padStart(2, "0")}:${String(startMinuteOfDay % 60).padStart(2, "0")}`,
			}),
	},
)

export const parseTime = (value: string): Time | null => {
	const parsed = Schema.decodeUnknownOption(Time)(value.trim())
	return Option.isSome(parsed) ? parsed.value : null
}

export const parseMinuteOfDay = (value: string): number | null => {
	const parsed = parseTime(value)
	return parsed == null ? null : toMinuteOfDay(parsed)
}

export const parseIsoLocalDate = (value: string): LocalDate | null => {
	const parsed = Schema.decodeUnknownOption(LocalDate)(value.trim())
	return Option.isSome(parsed) ? parsed.value : null
}
