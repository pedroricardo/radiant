import { Context, Data, Layer } from "effect"

export class NotImplementedError extends Data.TaggedError("NotImplementedError")<{
	readonly serviceName: string
	readonly property: string
	readonly message: string
}> {}

const getServiceName = (tag: unknown): string => {
	if (typeof tag === "object" && tag !== null && "_id" in tag) {
		const id = (tag as { _id?: unknown })._id
		if (typeof id === "string" && id.length > 0) {
			return id
		}
	}

	if (typeof tag === "function" && "key" in tag) {
		const key = (tag as { key?: unknown }).key
		if (typeof key === "string" && key.length > 0) {
			return key
		}
	}

	return "UnknownService"
}

export const makeUnimplementedService = <S extends object>(
	serviceName: string,
	overrides?: Partial<S>,
): S =>
	new Proxy((overrides ?? {}) as S, {
		get(_target, property) {
			if (overrides != null && property in overrides) {
				return overrides[property as keyof S]
			}
			throw new NotImplementedError({
				serviceName,
				property: String(property),
				message: `Service ${serviceName} does not implement property ${String(property)} in this test`,
			})
		},
	})

export const makeUnimplementedServiceLayer = <I, S extends object>(
	tag: Context.Tag<I, S>,
	overrides?: Partial<S>,
): Layer.Layer<I> => Layer.succeed(tag, makeUnimplementedService<S>(getServiceName(tag), overrides))
