import { Radio, User } from "@radiant/client"
import { Array, Cache, Duration, Effect, Option } from "effect"
import { and, eq } from "drizzle-orm"
import * as crypto from "node:crypto"

import * as IcyEncoder from "../IcyEncoder"
import { Drizzle } from "../Drizzle"
import { radios } from "../Drizzle/schema/radios"
import { RadioManagerConfig } from "./RadioManagerConfig"
import * as RadioStream from "./RadioStream"

type CreateRadioInput = {
	name: string
	slug: string
	description?: string | null
	timezone: string
	defaultCrossfadeMs?: number
	isPublic?: boolean
	createdByUserId: User.UserId
}

type UpdateRadioInput = {
	name?: string
	slug?: string
	description?: string | null
	timezone?: string
	defaultCrossfadeMs?: number
	isPublic?: boolean
}

const makeRadioId = (): Radio.RadioId =>
	`${Radio.idPrefix}_${crypto.randomUUID()}` as Radio.RadioId

export class RadioManager extends Effect.Service<RadioManager>()("RadioManager", {
	accessors: true,
	scoped: Effect.gen(function* () {
		const radiosCache = yield* Cache.make({
			capacity: Infinity,
			lookup: RadioStream.startRadio,
			timeToLive: Duration.infinity,
		})

		const encoder = yield* IcyEncoder.IcyEncoder
		const db = yield* Drizzle

		const getRadioInfo = Effect.fn("RadioManager.getRadioInfo")(function* (
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
			)
		})

		const listUserRadios = Effect.fn("RadioManager.listUserRadios")(function* (
			userId: User.UserId,
		) {
			return yield* Effect.tryPromise({
				try: () =>
					db
						.select()
						.from(radios)
						.where(eq(radios.createdByUserId, userId)),
				catch: (e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "failed to list user radios from database",
						cause: e,
					}),
			})
		})

		const createRadio = Effect.fn("RadioManager.createRadio")(function* (
			input: CreateRadioInput,
		) {
			const radioId = makeRadioId()

			const inserted = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.insert(radios)
							.values({
								id: radioId,
								name: input.name,
								slug: input.slug,
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
						message: "database did not return created radio"
					}),
				),
			)
		})

		const updateRadio = Effect.fn("RadioManager.updateRadio")(function* (
			radioId: Radio.RadioId,
			input: UpdateRadioInput,
		) {
			yield* getRadioInfo(radioId)

			const updated = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(radios)
							.set({
								...input,
								updatedAt: new Date(),
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
			)
		})

		const deleteRadio = Effect.fn("RadioManager.deleteRadio")(function* (
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

			yield* radiosCache.invalidate(radioId)
		})

		const getUserRadioInfo = Effect.fn("RadioManager.getUserRadioInfo")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
		) {
			const radioInfo = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(radios)
							.where(
								and(
									eq(radios.id, radioId),
									eq(radios.createdByUserId, userId),
								),
							),
					catch: (e) =>
						Radio.Errors.RadioManagerDatabaseError.make({
							message: "failed to fetch user radio info from database",
							cause: e,
						}),
				}),
			)

			return yield* radioInfo.pipe(
				Effect.catchAll(() => Radio.Errors.RadioNotFound.make()),
			)
		})

		const updateUserRadio = Effect.fn("RadioManager.updateUserRadio")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
			input: UpdateRadioInput,
		) {
			yield* getUserRadioInfo(userId, radioId)

			const updated = Array.head(
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(radios)
							.set({
								...input,
								updatedAt: new Date(),
							})
							.where(
								and(
									eq(radios.id, radioId),
									eq(radios.createdByUserId, userId),
								),
							)
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
			)
		})

		const deleteUserRadio = Effect.fn("RadioManager.deleteUserRadio")(function* (
			userId: User.UserId,
			radioId: Radio.RadioId,
		) {
			yield* getUserRadioInfo(userId, radioId)

			yield* Effect.tryPromise({
				try: () =>
					db
						.delete(radios)
						.where(
							and(
								eq(radios.id, radioId),
								eq(radios.createdByUserId, userId),
							),
						),
				catch: (e) =>
					Radio.Errors.RadioManagerDatabaseError.make({
						message: "failed to delete user radio from database",
						cause: e,
					}),
			})

			yield* radiosCache.invalidate(radioId)
			// TODO: notify radio to stop streaming, including radios on other Radiant instances
		})

		const getStream = Effect.fn("RadioManager.getStream")(
			function* (radioId: Radio.RadioId) {
				const radio = yield* getRadioInfo(radioId)
				const radioStream = yield* radiosCache.get(radioId)

				return yield* RadioStream.cloneStream(radioStream, {
					kbps: 128,
					title: radio.name,
				})
			},
			Effect.provideService(IcyEncoder.IcyEncoder, encoder),
		)

		return {
			getStream,
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
	dependencies: [RadioManagerConfig.Default, IcyEncoder.layer],
}) {}

export const layer = RadioManager.Default
export const layerNoConfig = RadioManager.DefaultWithoutDependencies
export { RadioManagerConfig as Config }
