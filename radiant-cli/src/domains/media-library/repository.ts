import { Effect } from "effect"
import { and, asc, eq } from "drizzle-orm"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import { mediaNodeAudioMetadata } from "@radiant/backend/services/Drizzle/schema/mediaNodeAudioMetadata"
import { mediaNodes } from "@radiant/backend/services/Drizzle/schema/mediaNodes"
import type { Radio } from "@radiant/client/lib"
import { FetchAudioNodesError } from "./errors"

export type AudioNodeRow = {
	readonly media_nodes: typeof mediaNodes.$inferSelect
	readonly media_node_audio_metadata: typeof mediaNodeAudioMetadata.$inferSelect
}

export const fetchAudioNodes = (radioId: Radio.RadioId) =>
	Effect.gen(function* () {
		const db = yield* Drizzle.Drizzle

		return yield* Effect.tryPromise({
			try: () =>
				db
					.select()
					.from(mediaNodes)
					.innerJoin(
						mediaNodeAudioMetadata,
						eq(mediaNodeAudioMetadata.mediaNodeId, mediaNodes.id),
					)
					.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.kind, "audio_file")))
					.orderBy(asc(mediaNodes.name)),
			catch: (cause) => new FetchAudioNodesError({ radioId, cause }),
		})
	})
