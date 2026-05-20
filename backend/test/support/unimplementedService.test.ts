import { describe, expect } from "bun:test"
import { Context, Effect } from "effect"

import { it } from "../../bun-test-effect"
import {
	makeUnimplementedService,
	makeUnimplementedServiceLayer,
	NotImplementedError,
} from "./unimplementedService"

class ExampleService extends Context.Tag("ExampleService")<
	ExampleService,
	{
		readonly doThing: () => Effect.Effect<void>
		readonly value: string
	}
>() {}

describe("makeUnimplementedService", () => {
	it.effect("throws NotImplementedError when a property is accessed", () =>
		Effect.sync(() => {
			const service = makeUnimplementedService<{
				readonly doThing: () => Effect.Effect<void>
			}>("ExampleService")

			expect(() => service.doThing).toThrow(NotImplementedError)
		}),
	)

	it.effect("returns provided overrides without throwing", () =>
		Effect.sync(() => {
			const service = makeUnimplementedService<{
				readonly doThing: () => string
				readonly value: string
			}>("ExampleService", {
				doThing: () => "ok",
			})

			expect(service.doThing()).toBe("ok")
			expect(() => service.value).toThrow(NotImplementedError)
		}),
	)

	it.layer(makeUnimplementedServiceLayer(ExampleService))(({ scoped }) => {
		scoped("provides a service that throws on property access", () =>
			Effect.gen(function* () {
				const service = yield* ExampleService

				const error = yield* Effect.sync(() => {
					try {
						void service.value
						return null
					} catch (cause) {
						return cause
					}
				})

				expect(error).toBeInstanceOf(NotImplementedError)
				expect(error).toMatchObject({
					_tag: "NotImplementedError",
					serviceName: "ExampleService",
					property: "value",
				})
			}),
		)
	})

	it.layer(
		makeUnimplementedServiceLayer(ExampleService, {
			value: "ready",
		}),
	)(({ scoped }) => {
		scoped("uses layer overrides for selected properties", () =>
			Effect.gen(function* () {
				const service = yield* ExampleService
				expect(service.value).toBe("ready")
				expect(() => service.doThing).toThrow(NotImplementedError)
			}),
		)
	})
})
