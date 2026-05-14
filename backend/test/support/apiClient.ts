import { Etag, FileSystem, HttpApiBuilder, HttpApp, HttpPlatform, Path } from "@effect/platform"
import type { Api } from "@effect/platform/HttpApi"
import { Middleware, Router } from "@effect/platform/HttpApiBuilder"
import * as RadiantClient from "@radiant/client"
import { Effect } from "effect"

export type InProcessApiClientRuntime =
	| Api
	| Router
	| Middleware
	| HttpPlatform.HttpPlatform
	| Etag.Generator
	| FileSystem.FileSystem
	| Path.Path

export const makeAuthenticatedFetch = (sessionId: `se_${string}`) =>
	Effect.gen(function* () {
		const runtime = yield* Effect.runtime<InProcessApiClientRuntime>()
		const handler = HttpApp.toWebHandlerRuntime(runtime)(yield* HttpApiBuilder.httpApp)

		return (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
			const mergedHeaders = new Headers({
				authorization: `Bearer ${sessionId}`,
				...(init?.headers instanceof Headers
					? Object.fromEntries(init.headers.entries())
					: Array.isArray(init?.headers)
						? Object.fromEntries(init.headers)
						: (init?.headers ?? {})),
			})

			return handler(
				input instanceof Request
					? new Request(input, {
							...init,
							headers: mergedHeaders,
						})
					: new Request(input instanceof URL ? input.toString() : input, {
							...init,
							headers: mergedHeaders,
						}),
			)
		}
	})

export const makeClientLayer = (sessionId: `se_${string}`) =>
	Effect.gen(function* () {
		const authenticatedFetch = yield* makeAuthenticatedFetch(sessionId)
		return RadiantClient.withHandler((request) => authenticatedFetch(request))
	})
