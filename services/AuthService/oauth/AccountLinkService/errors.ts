import type { User } from "$lib";
import { Data } from "effect";

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{userId: User.UserId}> {}
export class AccountLinkError extends Data.TaggedError("AccountLinkError")<{ message: string, cause: unknown }> {}
export class AccountLinkLookupError extends Data.TaggedError("AccountLinkError")<{ message: string, cause: unknown }> {}
