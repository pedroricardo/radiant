import type { MediaNode, Playlist, Playout } from "@radiant/client/lib"

export type BlockKind = "weekly" | "one-off"

export type BlockTargetSelection =
	| {
			readonly targetType: "audio_file"
			readonly mediaNodeId: MediaNode.MediaNodeId
			readonly playlistId: null
	  }
	| {
			readonly targetType: "playlist"
			readonly mediaNodeId: null
			readonly playlistId: Playlist.PlaylistId
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
	readonly date: {
		readonly year: number
		readonly month: number
		readonly day: number
	}
	readonly startMinuteOfDay: number
	readonly endMinuteOfDay: number
}

export type BlockDraft = WeeklyBlockDraft | OneOffBlockDraft
