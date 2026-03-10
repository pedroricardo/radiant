import * as Id from "../Id"
export const idPrefix = "user" as const
export const UserId = Id.schema(idPrefix)
export type UserId = typeof UserId.Type
