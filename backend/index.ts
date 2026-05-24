import { HttpApiBuilder, HttpApiSwagger, HttpApp, HttpServer } from "@effect/platform"
import { Middleware, Router } from "@effect/platform/HttpApiBuilder"
import * as RadiantClient from "@radiant/client"
import { Effect, Layer, ManagedRuntime } from "effect"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { mediaLibraryGroupLive } from "./routes/mediaLibrary"
import { radioGroupLive } from "./routes/radios"
import { scheduleBlocksGroupLive } from "./routes/scheduleBlocks"
import { usersGroupLive } from "./routes/users"

export const RadiantApiImpl = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
	Layer.provide(radioGroupLive),
	Layer.provide(scheduleBlocksGroupLive),
	Layer.provide(mediaLibraryGroupLive),
	Layer.provide(AuthorizationLive),
	Layer.provideMerge(HttpServer.layerContext),
	Layer.provideMerge(Router.Live),
	Layer.provideMerge(Middleware.layer),
)
const apiLive = RadiantApiImpl.pipe(Layer.provide(ProductionLayer))
const swaggerLive = HttpApiSwagger.layer({ path: "/api/docs" }).pipe(Layer.provide(apiLive))
const RadiantApiLiveHttpServer = Layer.mergeAll(apiLive, swaggerLive)
export const RadiantApiLiveHttpServerRuntime = ManagedRuntime.make(RadiantApiLiveHttpServer)
declare global {
	var globalWebHandler: {handler: (req: Request) => Promise<Response>, dispose: () => Promise<void>, runtime: Awaited<ReturnType<typeof RadiantApiLiveHttpServerRuntime.runtime>>, disposed: boolean}
}

export const inProcessApiClient = async (headers: () => Promise<Headers>) => {
	const _headers = await headers()
	return RadiantClient.withHandler(
		async (r) =>
			await globalWebHandler.handler(
				new Request(r, {
					headers: _headers,
				}),
			),
	)
}
