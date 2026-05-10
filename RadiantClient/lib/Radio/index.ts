import * as Id from "../Id"
export const idPrefix = "radio" as const
export const RadioId = Id.schema(idPrefix)
export type RadioId = typeof RadioId.Type
