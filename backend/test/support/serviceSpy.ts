import { Context, Effect, Layer, Ref } from "effect"

type AnyFunction = (...args: ReadonlyArray<any>) => any

type MethodNames<T extends object> = {
	[K in keyof T]-?: T[K] extends AnyFunction ? K : never
}[keyof T] &
	string

export type ServiceSpyCall<T extends object> = {
	[K in MethodNames<T>]: {
		readonly method: K
		readonly args: Parameters<Extract<T[K], AnyFunction>>
	}
}[MethodNames<T>]

export type ServiceSpy<T extends object> = {
	readonly calls: Ref.Ref<ReadonlyArray<ServiceSpyCall<T>>>
	readonly getCalls: Effect.Effect<ReadonlyArray<ServiceSpyCall<T>>>
	readonly clear: Effect.Effect<void>
}

const wrapServiceWithSpy = <T extends object>(
	service: T,
	calls: Ref.Ref<ReadonlyArray<ServiceSpyCall<T>>>,
): T =>
	new Proxy(service, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver)
			if (typeof value !== "function") {
				return value
			}

			return (...args: ReadonlyArray<unknown>) => {
				Effect.runSync(
					Ref.update(calls, (existingCalls) => [
						...existingCalls,
						{
							method: String(property),
							args,
						} as ServiceSpyCall<T>,
					]),
				)
				return value.apply(target, args)
			}
		},
	})

export const makeServiceSpy = <T extends object>(
	service: T,
): {
	readonly service: T
	readonly spy: ServiceSpy<T>
} => {
	const calls = Effect.runSync(Ref.make<ReadonlyArray<ServiceSpyCall<T>>>([]))

	return {
		service: wrapServiceWithSpy(service, calls),
		spy: {
			calls,
			getCalls: Ref.get(calls),
			clear: Ref.set(calls, []),
		},
	}
}

export const makeServiceSpyLayer = <I, S extends object, E, R>(
	tag: Context.Tag<I, S>,
	layer: Layer.Layer<I, E, R>,
): {
	readonly layer: Layer.Layer<I, E, R>
	readonly spy: ServiceSpy<S>
} => {
	const calls = Effect.runSync(Ref.make<ReadonlyArray<ServiceSpyCall<S>>>([]))

	return {
		layer: Layer.effect(
			tag,
			Effect.gen(function* () {
				const service = yield* tag
				return wrapServiceWithSpy(service, calls)
			}),
		).pipe(Layer.provide(layer)),
		spy: {
			calls,
			getCalls: Ref.get(calls),
			clear: Ref.set(calls, []),
		},
	}
}
