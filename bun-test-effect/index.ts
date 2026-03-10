import type * as BunTest from "bun:test"
import * as bunTest from "bun:test"
import { Cause, Effect, Exit, Fiber, Layer, Scope, TestContext, type TestServices } from "effect"
import type { Mutable } from "effect/Types"

const runPromise = <E, A>(effect: Effect.Effect<A, E>) =>
	Effect.gen(function* () {
		const exitFiber = yield* Effect.fork(Effect.exit(effect))

		const exit = yield* Fiber.join(exitFiber)
		if (Exit.isSuccess(exit)) {
			return () => exit.value
		} else {
			if (Cause.isInterruptedOnly(exit.cause)) {
				return () => {
					throw new Error("All fibers interrupted without errors.")
				}
			}
			const errors = Cause.prettyErrors(exit.cause)
			for (let i = 1; i < errors.length; i++) {
				yield* Effect.logError(errors[i])
			}
			return () => {
				throw errors[0]
			}
		}
	})
		.pipe((effect) => Effect.runPromise(effect))
		.then((f) => f())

type LayerOptions<EnableTestServices extends boolean> = {
	testServices?: EnableTestServices
	memomap?: Layer.MemoMap
}
export function layer<R, E, const EnableTestServices extends boolean = true>(
	layer_: Layer.Layer<R, E>,
	options?: LayerOptions<EnableTestServices>,
) {
	type EffectiveServices = EnableTestServices extends true ? R | TestServices.TestServices : R
	type LayerMaybeWithTestEnv = Layer.Layer<EffectiveServices, E>
	type TestEffect<E, AdditionalServices = never> = Effect.Effect<
		void,
		E,
		EffectiveServices | AdditionalServices
	>
	type NormalEffectTester<AdditionalServices = never> = <E>(
		label: string,
		test: () => TestEffect<E, AdditionalServices>,
		options?: BunTest.TestOptions,
	) => void
	type ConditionalEffectTester = (
		condition: boolean,
	) => <E>(label: string, test: () => TestEffect<E>, options?: BunTest.TestOptions) => void
	type BulkEffectTester<AdditionalServices = never> = <T>(
		table: T[],
	) => <E>(
		label: string,
		fn: (...args: T extends readonly any[] ? Mutable<T> : [T]) => TestEffect<E, AdditionalServices>,
		options?: BunTest.TestOptions,
	) => void
	type Testers<R> = {
		[K in "effect" | "only" | "failing" | "skip"]: NormalEffectTester
	} & {
		[K2 in "if" | "skipIf" | "todoIf"]: ConditionalEffectTester
	} & {
		todo: typeof bunTest.it.todo
		each: BulkEffectTester
		eachScoped: BulkEffectTester<Scope.Scope>
		layer: <R2, E2, const EnableTestServices extends boolean = true>(
			layer_: Layer.Layer<R2, E2>,
			options?: LayerOptions<EnableTestServices>,
		) => ReturnType<typeof layer<R2 | R, E2, EnableTestServices>>
		scoped: NormalEffectTester<Scope.Scope>
	}
	const enableTestServices =
		options != null && options.testServices != null ? options.testServices : true
	const withTestEnv = (
		enableTestServices ? Layer.provideMerge(layer_, TestContext.TestContext) : layer_
	) as LayerMaybeWithTestEnv
	const memomap = options?.memomap ?? Effect.runSync(Layer.makeMemoMap)
	const scope = Effect.runSync(Scope.make())
	const runtimeEffect = Layer.toRuntimeWithMemoMap(withTestEnv, memomap).pipe(
		Scope.extend(scope),
		Effect.orDie,
		Effect.cached,
		Effect.runSync,
	)
	const createNormalTester =
		(rawTester: typeof bunTest.it.only): NormalEffectTester =>
		(label, test, options) => {
			rawTester(
				label,
				() =>
					runPromise(
						Effect.flatMap(runtimeEffect, (runtime) => test().pipe(Effect.provide(runtime))),
					),
				options,
			)
		}
	const createScopedTester =
		(rawTester: typeof bunTest.it.only): NormalEffectTester<Scope.Scope> =>
		(label, test, options) => {
			rawTester(
				label,
				() =>
					runPromise(
						Effect.flatMap(runtimeEffect, (runtime) =>
							test().pipe(Effect.scoped, Effect.provide(runtime)),
						),
					),
				options,
			)
		}
	const createConditionalTester =
		(rawTester: typeof bunTest.it.if): ConditionalEffectTester =>
		(condition) => {
			const intermediateFn = rawTester(condition)
			return (label, test, options) => {
				intermediateFn(
					label,
					() =>
						runPromise(
							Effect.flatMap(runtimeEffect, (runtime) => test().pipe(Effect.provide(runtime))),
						),
					options,
				)
			}
		}
	const createScopedBulkTester =
		(rawTester: typeof bunTest.it.each): BulkEffectTester<Scope.Scope> =>
		(table) => {
			const intermediateFn = rawTester(table)
			return (label, test, options) => {
				intermediateFn(
					label,
					(...args: any) =>
						runPromise(
							Effect.flatMap(runtimeEffect, (runtime) =>
								test(...args).pipe(Effect.scoped, Effect.provide(runtime)),
							),
						),
					options,
				)
			}
		}
	const createBulkTester =
		(rawTester: typeof bunTest.it.each): BulkEffectTester =>
		(table) => {
			const intermediateFn = rawTester(table)
			return (label, test, options) => {
				intermediateFn(
					label,
					(...args: any) =>
						runPromise(
							Effect.flatMap(runtimeEffect, (runtime) =>
								test(...args).pipe(Effect.provide(runtime)),
							),
						),
					options,
				)
			}
		}
	bunTest.beforeAll(() => runPromise(Effect.asVoid(runtimeEffect)))
	bunTest.afterAll(() => runPromise(Scope.close(scope, Exit.void)))
	const testers: Testers<EffectiveServices> = {
		effect: createNormalTester(bunTest.it.bind(bunTest)),
		scoped: createScopedTester(bunTest.it.bind(bunTest)),
		get only() {
			return createNormalTester(bunTest.it.only.bind(bunTest.it))
		},
		failing: createNormalTester(bunTest.it.failing.bind(bunTest.it)),
		todo: bunTest.it.todo.bind(bunTest.it),
		skip: createNormalTester(bunTest.it.skip.bind(bunTest.it)),
		if: createConditionalTester(bunTest.it.if.bind(bunTest.it)),
		skipIf: createConditionalTester(bunTest.it.skipIf.bind(bunTest.it)),
		todoIf: createConditionalTester(bunTest.it.todoIf.bind(bunTest.it)),
		each: createBulkTester(bunTest.it.each.bind(bunTest.it)),
		eachScoped: createScopedBulkTester(bunTest.it.each.bind(bunTest.it)),
		layer: (layer_, options) =>
			layer(Layer.provideMerge(layer_, withTestEnv), { ...options, memomap }),
	}
	return <T>(cb: (testers: Testers<EffectiveServices>) => T): T => cb(testers)
}
export const it = layer(Layer.empty)((it) => it)
export const itLive = layer(Layer.empty, { testServices: false })((it) => it)
