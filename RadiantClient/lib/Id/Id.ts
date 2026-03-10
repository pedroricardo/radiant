import { varchar } from "drizzle-orm/pg-core"
import { Schema } from "effect"
export const DEFAULT_MAX_ID_SIZE = 12

function randomBytes(size: number) {
	const bytes: number[] = []
	for (let i = 0; i < size; i++) {
		bytes.push(Math.floor(Math.random() * 256))
	}
	return {
		toString(format: string) {
			if (format === "hex") {
				return bytes.map((b) => b.toString(16).padStart(2, "0")).join("")
			}
			throw new Error(`Unsupported format: ${format}`)
		},
	}
}

export function generateRandomId<T extends string>(
	prefix: T,
	size = DEFAULT_MAX_ID_SIZE,
): `${T}_${string}` {
	const randomString = randomBytes(size / 2).toString("hex") + (+new Date()).toString(16)
	return `${prefix}_${randomString}`
}

export function idSchema<Prefix extends string>(
	prefix: Prefix,
	resourceName?: string,
	size?: number,
) {
	return Schema.asSchema(
		Schema.NonEmptyString.pipe(
			Schema.startsWith(`${prefix}_`),
			Schema.annotations({
				examples: [generateRandomId(prefix, size) as string],
				...(resourceName ? { title: `${resourceName} Id` } : {}),
			}),
		),
	) as Schema.Schema<`${Prefix}_${string}`>
}
