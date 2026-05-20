import { HttpApiBuilder, HttpApiSwagger, HttpApp, HttpServer } from "@effect/platform"
import { Middleware, Router } from "@effect/platform/HttpApiBuilder"
import * as RadiantClient from "@radiant/client"
import { Effect, Layer, ManagedRuntime } from "effect"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { mediaLibraryGroupLive } from "./routes/mediaLibrary"
import { radioGroupLive } from "./routes/radios"
import { usersGroupLive } from "./routes/users"

declare global {
	// eslint-disable-next-line no-var
	var __radiantBackendDispose: (() => Promise<void>) | undefined
}

export const RadiantApiImpl = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
	Layer.provide(radioGroupLive),
	Layer.provide(mediaLibraryGroupLive),
	Layer.provide(AuthorizationLive),
	Layer.merge(Layer.mergeAll(HttpServer.layerContext, Router.Live, Middleware.layer)),
)
const apiLive = RadiantApiImpl.pipe(Layer.provide(ProductionLayer))
const swaggerLive = HttpApiSwagger.layer({ path: "/api/docs" }).pipe(Layer.provide(apiLive))
const RadiantApiLiveHttpServer = Layer.mergeAll(apiLive, swaggerLive)
export const RadiantApiLiveHttpServerRuntime = ManagedRuntime.make(RadiantApiLiveHttpServer)

// In `next dev`, backend modules can be re-evaluated without a full process restart.
// We keep the previous module's dispose hook on `globalThis` so the new module instance
// can tear down the old managed runtime before serving requests with the fresh code.
const previousDispose = globalThis.__radiantBackendDispose
delete globalThis.__radiantBackendDispose

const disposePreviousRuntime = previousDispose?.() ?? Promise.resolve()

const disposeCurrentRuntime = async () => {
	await RadiantApiLiveHttpServerRuntime.dispose()
	// Only clear the global slot if it still points at this runtime instance.
	if (globalThis.__radiantBackendDispose === disposeCurrentRuntime) {
		delete globalThis.__radiantBackendDispose
	}
}

globalThis.__radiantBackendDispose = disposeCurrentRuntime

export const webHandler = {
	handler: async (req: Request) => {
		// Avoid serving requests with two backend runtimes alive at once after HMR.
		await disposePreviousRuntime
		const r = await webHandler.runtime.runtime()
		return HttpApp.toWebHandlerRuntime(r)(
			await HttpApiBuilder.httpApp.pipe(Effect.provide(webHandler.runtime), Effect.runPromise),
		)(req)
	},
	dispose: disposeCurrentRuntime,
	runtime: RadiantApiLiveHttpServerRuntime,
}

export const inProcessApiClient = async (headers: () => Promise<Headers>) => {
	const _headers = await headers()
	return RadiantClient.withHandler(
		async (r) =>
			await webHandler.handler(
				new Request(r, {
					headers: _headers,
				}),
			),
	)
}
