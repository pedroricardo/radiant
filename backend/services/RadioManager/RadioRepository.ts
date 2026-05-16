import { Radio, type User } from "@radiant/client"
import { and, eq } from "drizzle-orm"
import { Array, DateTime, Effect, Schema } from "effect"
import { generateRandomId } from "../../../RadiantClient/lib/Id/Id"
import { Drizzle } from "../Drizzle"
import { radios } from "../Drizzle/schema/radios"

type CreateRadioInput = {
	name: string
	description?: string | null
	timezone: string
	defaultCrossfadeMs?: number
	isPublic?: boolean
	createdByUserId: User.UserId
}

type UpdateRadioInput = {
	name?: string
	description?: string | null
	timezone?: string
	defaultCrossfadeMs?: number
	isPublic?: boolean
}

export class RadioRepository extends Effect.Service<RadioRepository>()("RadioRepository", {
	accessors: true,
	effect: Effect.gen(function* () {
		const db = yield* Drizzle
		const getRadioInfo = Effect.fn("RadioRepository.getRadioInfo")(function* (
			radioId: Radio.RadioId,
		) {
			const radioInfo = Array.head(
				yield* Effect.tryPromise({
					try: () => db.select().from(radios).where(eq(radios.id, radioId)),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to fetch radio info from database",
							cause: e,
						}),
				}),
			)

			return yield* radioInfo.pipe(
				Effect.catchAll(() => Radio.Errors.RadioNotFound.make()),
				Effect.flatMap(Schema.decode(Radio.RadioInfo)),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const listUserRadios = Effect.fn("RadioRepository.listUserRadios")(function* (
			userId: User.UserId,
		) {
			return yield* Effect.tryPromise({
				try: () => db.select().from(radios).where(eq(radios.createdByUserId, userId)),
				catch: (e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "failed to list user radios from database",
						cause: e,
					}),
			}).pipe(
				Effect.flatMap(Schema.decode(Schema.Array(Radio.RadioInfo))),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const createRadio = Effect.fn("RadioRepository.createRadio")(function* (
			input: CreateRadioInput,
		) {
			const radioId = generateRandomId(Radio.idPrefix)

			const inserted = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.insert(radios)
							.values({
								id: radioId,
								name: input.name,
								description: input.description ?? null,
								timezone: input.timezone,
								defaultCrossfadeMs: input.defaultCrossfadeMs ?? 0,
								isPublic: input.isPublic ?? false,
								createdByUserId: input.createdByUserId,
							})
							.returning(),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to create radio in database",
							cause: e,
						}),
				}),
			)

			return yield* inserted.pipe(
				Effect.catchAll((e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "database did not return created radio",
					}),
				),
				Effect.flatMap(Schema.decode(Radio.RadioInfo)),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const updateRadio = Effect.fn("RadioRepository.updateRadio")(function* (
			radioId: Radio.RadioId,
			input: UpdateRadioInput,
		) {
			yield* getRadioInfo(radioId)
			const now = yield* Effect.map(DateTime.nowAsDate, (d) => d.toISOString())
			const updated = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(radios)
							.set({
								...input,
								updatedAt: now,
							})
							.where(eq(radios.id, radioId))
							.returning(),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to update radio in database",
							cause: e,
						}),
				}),
			)

			return yield* updated.pipe(
				Effect.catchAll(() => Radio.Errors.RadioNotFound.make()),
				Effect.flatMap(Schema.decode(Radio.RadioInfo)),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const deleteRadio = Effect.fn("RadioRepository.deleteRadio")(function* (
			radioId: Radio.RadioId,
		) {
			yield* getRadioInfo(radioId)

			yield* Effect.tryPromise({
				try: () => db.delete(radios).where(eq(radios.id, radioId)),
				catch: (e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "failed to delete radio from database",
						cause: e,
					}),
			})
		})

		const getUserRadioInfo = Effect.fn("RadioRepository.getUserRadioInfo")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
		) {
			const radioInfo = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(radios)
							.where(and(eq(radios.id, radioId), eq(radios.createdByUserId, userId))),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to fetch user radio info from database",
							cause: e,
						}),
				}),
			)

			return yield* radioInfo.pipe(
				Effect.catchAll(() => Radio.Errors.RadioNotFound.make()),
				Effect.flatMap(Schema.decode(Radio.RadioInfo)),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const updateUserRadio = Effect.fn("RadioRepository.updateUserRadio")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
			input: UpdateRadioInput,
		) {
			yield* getUserRadioInfo(userId, radioId)
			const now = yield* Effect.map(DateTime.nowAsDate, (d) => d.toISOString())
			const updated = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(radios)
							.set({
								...input,
								updatedAt: now,
							})
							.where(and(eq(radios.id, radioId), eq(radios.createdByUserId, userId)))
							.returning(),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to update user radio in database",
							cause: e,
						}),
				}),
			)

			return yield* updated.pipe(
				Effect.catchAll(() => Radio.Errors.RadioNotFound.make()),
				Effect.flatMap(Schema.decode(Radio.RadioInfo)),
				Effect.catchTag("ParseError", Effect.die),
			)
		})

		const deleteUserRadio = Effect.fn("RadioRepository.deleteUserRadio")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
		) {
			yield* getUserRadioInfo(userId, radioId)

			yield* Effect.tryPromise({
				try: () =>
					db.delete(radios).where(and(eq(radios.id, radioId), eq(radios.createdByUserId, userId))),
				catch: (e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "failed to delete user radio from database",
						cause: e,
					}),
			})

			// TODO: notify radio to stop streaming, including radios on other Radiant instances
		})
		return {
			getRadioInfo,
			getUserRadioInfo,
			listUserRadios,
			createRadio,
			updateRadio,
			updateUserRadio,
			deleteRadio,
			deleteUserRadio,
		}
	}),
}) {}
