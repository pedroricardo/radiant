import { HttpApiBuilder, HttpApiSwagger, HttpServer } from "@effect/platform"
import * as RadiantClient from "@radiant/client"
import { Layer } from "effect"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { radioGroupLive } from "./routes/radios"
import { usersGroupLive } from "./routes/users"

const RadiantApiLive = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
	Layer.provide(radioGroupLive),
	Layer.provide(AuthorizationLive)
)
const apiLive = RadiantApiLive.pipe(Layer.provide(ProductionLayer))
const swaggerLive = HttpApiSwagger.layer({ path: "/api/docs" }).pipe(Layer.provide(apiLive))
const RadiantApiLiveHttpServer = Layer.mergeAll(apiLive, swaggerLive, HttpServer.layerContext)

export const webHandler = HttpApiBuilder.toWebHandler(RadiantApiLiveHttpServer)
