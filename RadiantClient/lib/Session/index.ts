import * as Id from "../Id"
export const idPrefix = "se" as const
export const SessionId = Id.schema(idPrefix)
export type SessionId = typeof SessionId.Type
