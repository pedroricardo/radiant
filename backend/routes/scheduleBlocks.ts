import { HttpApiBuilder } from "@effect/platform"
import * as ApiContract from "@radiant/client/contract"
import { CurrentUser } from "@radiant/client/contract"
import { Schedule } from "@radiant/client/lib"
import { Effect, Schema } from "effect"

import { RadioManager, ScheduleBlockService } from "../services"

export const scheduleBlocksGroupLive = HttpApiBuilder.group(
	ApiContract.httpApi,
	"scheduleBlocks",
	(handlers) =>
		handlers
			.handle(
				"listBlocks",
				Effect.fn("scheduleBlocks.list")(function* ({ path: { radioId }, urlParams }) {
					const scheduleBlocks = yield* ScheduleBlockService.ScheduleBlockService
					const radioManager = yield* RadioManager.RadioManager
					yield* radioManager.getUserRadioInfo(yield* CurrentUser, radioId)
					const query = yield* Schema.decodeUnknown(Schedule.ScheduleBlocksQuery)({
						rangeStart: urlParams.rangeStart,
						rangeEnd: urlParams.rangeEnd,
						oneOffCursor: urlParams.oneOffCursor,
						oneOffLimit: urlParams.oneOffLimit == null ? undefined : Number(urlParams.oneOffLimit),
					}).pipe(
						Effect.mapError(
							() =>
								new Schedule.ScheduleBlockRepositoryError({
									operation: "decodeScheduleBlocksQuery",
									message: "Invalid schedule blocks query parameters.",
								}),
						),
					)
					return yield* scheduleBlocks.listBlocks(radioId, query)
				}),
			)
			.handle(
				"createBlock",
				Effect.fn("scheduleBlocks.create")(function* ({ path: { radioId }, payload }) {
					const scheduleBlocks = yield* ScheduleBlockService.ScheduleBlockService
					const radioManager = yield* RadioManager.RadioManager
					yield* radioManager.getUserRadioInfo(yield* CurrentUser, radioId)
					return yield* scheduleBlocks.createBlock(radioId, payload)
				}),
			)
			.handle(
				"updateBlock",
				Effect.fn("scheduleBlocks.update")(function* ({ path: { radioId, blockId }, payload }) {
					const scheduleBlocks = yield* ScheduleBlockService.ScheduleBlockService
					const radioManager = yield* RadioManager.RadioManager
					yield* radioManager.getUserRadioInfo(yield* CurrentUser, radioId)
					return yield* scheduleBlocks.updateBlock(radioId, blockId, payload)
				}),
			)
			.handle(
				"deleteBlock",
				Effect.fn("scheduleBlocks.delete")(function* ({ path: { radioId, blockId } }) {
					const scheduleBlocks = yield* ScheduleBlockService.ScheduleBlockService
					const radioManager = yield* RadioManager.RadioManager
					yield* radioManager.getUserRadioInfo(yield* CurrentUser, radioId)
					yield* scheduleBlocks.deleteBlock(radioId, blockId)
				}),
			)
			.handle(
				"validateBlock",
				Effect.fn("scheduleBlocks.validate")(function* ({ path: { radioId }, payload }) {
					const scheduleBlocks = yield* ScheduleBlockService.ScheduleBlockService
					const radioManager = yield* RadioManager.RadioManager
					yield* radioManager.getUserRadioInfo(yield* CurrentUser, radioId)
					return yield* scheduleBlocks.validateCandidate(radioId, payload.candidate, {
						excludeBlockId: payload.excludeBlockId,
						range: payload.range,
					})
				}),
			),
)
