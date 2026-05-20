import { describe, expect } from "bun:test"
import { Context, Effect, Layer } from "effect"

import { it } from "../../bun-test-effect"
import { makeServiceSpy, makeServiceSpyLayer } from "./serviceSpy"

class ExampleService extends Context.Tag("ExampleService")<
	ExampleService,
	{
		readonly name: string
		readonly ping: (value: string) => Effect.Effect<string>
		readonly add: (left: number, right: number) => number
	}
>() {}

const baseLayer = Layer.succeed(ExampleService, {
	name: "example",
	ping: (value: string) => Effect.succeed(`pong:${value}`),
	add: (left: number, right: number) => left + right,
})

const spied = makeServiceSpyLayer(ExampleService, baseLayer)

describe("makeServiceSpyLayer", () => {
	it.effect("records method calls on a raw service instance", () =>
		Effect.gen(function* () {
			const raw = makeServiceSpy({
				name: "raw",
				echo: (value: string) => `echo:${value}`,
			})

			yield* raw.spy.clear
			expect(raw.service.name).toBe("raw")
			expect(raw.service.echo("hello")).toBe("echo:hello")
			expect(yield* raw.spy.getCalls).toEqual([{ method: "echo", args: ["hello"] }])
		}),
	)

	it.layer(spied.layer)(({ scoped }) => {
		scoped("records method calls while preserving behavior", () =>
			Effect.gen(function* () {
				yield* spied.spy.clear

				const service = yield* ExampleService
				expect(service.name).toBe("example")
				expect(yield* service.ping("hello")).toBe("pong:hello")
				expect(service.add(2, 3)).toBe(5)

				expect(yield* spied.spy.getCalls).toEqual([
					{ method: "ping", args: ["hello"] },
					{ method: "add", args: [2, 3] },
				])
			}),
		)
	})
})
