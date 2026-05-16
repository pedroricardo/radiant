import { Effect } from "effect"
import { asc } from "drizzle-orm"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import { radios } from "@radiant/backend/services/Drizzle/schema/radios"
import { FetchRadiosError } from "./errors"

export type RadioRow = typeof radios.$inferSelect

export const fetchRadios = Effect.gen(function* () {
	const db = yield* Drizzle.Drizzle

	return yield* Effect.tryPromise({
		try: () => db.select().from(radios),
		catch: (cause) => new FetchRadiosError({ cause }),
	})
})
