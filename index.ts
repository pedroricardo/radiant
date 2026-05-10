import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import * as RadiantClient from "./RadiantClient"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { radioGroupLive } from "./routes/radios"
import { usersGroupLive } from "./routes/users"

const RadiantApiLive = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
	Layer.provide(radioGroupLive),
)
const RadiantApiLiveHttpServer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
	Layer.provide(HttpApiSwagger.layer()),
	Layer.provide(HttpApiBuilder.middlewareCors()),
	Layer.provide(RadiantApiLive),
	Layer.provide(AuthorizationLive),
	HttpServer.withLogAddress,
	Layer.provide(BunHttpServer.layer({ port: 3000, idleTimeout: 0 })),
)

BunRuntime.runMain(Layer.launch(RadiantApiLiveHttpServer.pipe(Layer.provide(ProductionLayer))))
