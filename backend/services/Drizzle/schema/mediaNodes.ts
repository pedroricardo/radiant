import { pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { MediaNode } from "../../../lib"

import { DbSchema } from ".."
import { radioIdType, radios } from "./radios"

export const mediaNodeIdType = () => DbSchema.id(MediaNode.idPrefix)

export const mediaNodes = pgTable(
	"media_nodes",
	{
		id: mediaNodeIdType().primaryKey().notNull(),
		radioId: radioIdType()
			.notNull()
			.references(() => radios.id, { onDelete: "cascade" }),
		parentId: varchar()
			.$type<MediaNode.MediaNodeId>()
			.references((): AnyPgColumn => mediaNodes.id, {
				onDelete: "cascade",
			}),
		kind: text({ enum: ["folder", "audio_file"] })
			.$type<MediaNode.MediaNodeKind>()
			.notNull(),
		name: varchar().notNull(),
		createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(mediaNodes) => [
		uniqueIndex("media_nodes_radio_parent_name_index").on(
			mediaNodes.radioId,
			mediaNodes.parentId,
			mediaNodes.name,
		),
	],
)

import type { AnyPgColumn } from "drizzle-orm/pg-core"
