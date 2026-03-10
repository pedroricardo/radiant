import { Id } from "$lib"
import { varchar } from "drizzle-orm/pg-core"

export function id<Prefix extends string>(prefix: Prefix, size?: number) {
	return varchar()
		.$defaultFn(() => Id.random(prefix, size))
		.$type<`${Prefix}_${string}`>()
}
