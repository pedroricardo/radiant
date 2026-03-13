import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import * as RadiantClient from "./RadiantClient"
import { ProductionLayer } from "./layers"
import { authGroupLive, AuthorizationLive } from "./routes/auth"
import { usersGroupLive } from "./routes/users"

const RadiantApiLive = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
	Layer.provide(authGroupLive),
)
const RadiantApiLiveHttpServer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
	Layer.provide(HttpApiSwagger.layer()),
	Layer.provide(HttpApiBuilder.middlewareCors()),
	Layer.provide(RadiantApiLive),
	Layer.provide(AuthorizationLive),
	HttpServer.withLogAddress,
	Layer.provide(BunHttpServer.layer({ port: 3000 })),
)

Layer.launch(RadiantApiLiveHttpServer.pipe(Layer.provide(ProductionLayer))).pipe(BunRuntime.runMain)
/*
Example Output:
User {
  id: 1,
  name: 'John Doe',
  createdAt: DateTime.Utc(2025-01-04T15:14:49.562Z)
}
*/
