import { HttpApiBuilder, HttpApiSwagger, HttpApp, HttpServer } from "@effect/platform"
import * as RadiantClient from "@radiant/client"
import { Effect, Layer, ManagedRuntime } from "effect"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { mediaLibraryGroupLive } from "./routes/mediaLibrary"
import { radioGroupLive } from "./routes/radios"
import { usersGroupLive } from "./routes/users"
import { Middleware, Router } from "@effect/platform/HttpApiBuilder"

export const RadiantApiImpl = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
	Layer.provide(radioGroupLive),
	Layer.provide(mediaLibraryGroupLive),
	Layer.provide(AuthorizationLive),
	Layer.merge(Layer.mergeAll(HttpServer.layerContext, Router.Live, Middleware.layer))
)
const apiLive = RadiantApiImpl.pipe(Layer.provide(ProductionLayer))
const swaggerLive = HttpApiSwagger.layer({ path: "/api/docs" }).pipe(Layer.provide(apiLive))
const RadiantApiLiveHttpServer = Layer.mergeAll(apiLive, swaggerLive)
export const RadiantApiLiveHttpServerRuntime = ManagedRuntime.make(RadiantApiLiveHttpServer)
export const webHandler = {
	handler: async (req: Request) => {
		const r = await webHandler.runtime.runtime()
		return HttpApp.toWebHandlerRuntime(r)(await HttpApiBuilder.httpApp.pipe(Effect.provide(webHandler.runtime), Effect.runPromise))(req)
	},
	dispose: RadiantApiLiveHttpServerRuntime.dispose,
	runtime: RadiantApiLiveHttpServerRuntime
};

export const inProcessApiClient = async (headers: () => Promise<Headers>) => {
	const _headers = await headers();
	return RadiantClient.withHandler(async (r) => await webHandler.handler(new Request(r, {
	headers: _headers
})))};
