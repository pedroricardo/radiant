import { inProcessApiClient, RadiantApiLiveHttpServerRuntime } from "@radiant/backend";
import { headers } from "next/headers";
import {Effect} from "effect"
import { ManagedRuntime } from "effect/ManagedRuntime";
import { RadiantClient } from "@radiant/client";

type RuntimeServices = typeof RadiantApiLiveHttpServerRuntime extends ManagedRuntime<infer A, any> ? A : never;

/**
 * Runs an `Effect` from the Next.js server side with the same backend/runtime
 * services that power the in-process Radiant API.
 *
 * What this does:
 * - captures the incoming request headers from the current Next.js request
 * - builds an in-process `RadiantClient` using those headers
 * - provides that client to the Effect you pass in
 * - executes the Effect on top of the backend managed runtime supplying all of the backend services with it
 *
 * Why this exists:
 * - the frontend and backend live in the same monorepo
 * - the backend exports a web handler instead of opening a separate API server
 * - server-rendered pages still need a convenient way to call the API
 * - this helper lets a Server Component talk to the backend without making a
 *   network roundtrip to `localhost`
 *
 * In practice, this means:
 * - cookies and auth headers from the current request are preserved
 * - the Effect can use `RadiantClient` as if it were calling a normal HTTP API
 * - requests stay in-process by going through the backend `webHandler`
 *
 * Where to use it:
 * - Server Components
 * - server-only helpers used by pages/layouts
 * - places where you need typed access to the backend during SSR
 *
 * Where not to use it:
 * - Client Components
 * - browser event handlers
 * - code that should run purely on the client after hydration
 *
 * Typical example:
 * ```ts
 * return runServerEffect(
 *   Effect.gen(function* () {
 *     const client = yield* RadiantClient
 *     return yield* client.users.getSelf()
 *   })
 * )
 * ```
 */
export const runServerEffect = async <A, E>(e: Effect.Effect<A, E, RuntimeServices | RadiantClient>) => RadiantApiLiveHttpServerRuntime.runPromise(e.pipe(Effect.provide(await inProcessApiClient(async() => new Headers(await headers())))))
