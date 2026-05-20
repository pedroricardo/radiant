import type { MediaNode, Playlist, Playout } from "@radiant/client/lib"
import type * as DateTime from "effect/DateTime"

export type BlockKind = "weekly" | "one-off"

export type BlockTargetSelection =
	| {
			readonly targetType: "audio_file"
			readonly mediaNodeId: MediaNode.MediaNodeId
			readonly playlistId: null
			readonly durationMs: number
	  }
	| {
			readonly targetType: "playlist"
			readonly mediaNodeId: null
			readonly playlistId: Playlist.PlaylistId
			readonly durationMs: null
	  }

export type WeeklyBlockDraft = {
	readonly blockKind: "weekly"
	readonly target: BlockTargetSelection
	readonly playbackMode: Playout.BlockPlaybackMode
	readonly playlistFillMode: Playout.PlaylistFillMode | null
	readonly weekday: number
	readonly startMinuteOfDay: number
	readonly endMinuteOfDay: number
}

export type OneOffBlockDraft = {
	readonly blockKind: "one-off"
	readonly target: BlockTargetSelection
	readonly playbackMode: Playout.BlockPlaybackMode
	readonly playlistFillMode: Playout.PlaylistFillMode | null
	readonly startsAt: DateTime.Zoned
	readonly date: {
		readonly year: number
		readonly month: number
		readonly day: number
	}
	readonly startMinuteOfDay: number
	readonly endMinuteOfDay: number | null
}

export type BlockDraft = WeeklyBlockDraft | OneOffBlockDraft
