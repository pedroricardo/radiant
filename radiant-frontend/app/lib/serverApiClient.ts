import { inProcessApiClient, RadiantApiLiveHttpServerRuntime } from "@radiant/backend";
import { cookies, headers } from "next/headers";
import {Effect} from "effect"
import { ManagedRuntime } from "effect/ManagedRuntime";
import { RadiantClient } from "@radiant/client";

type RuntimeServices = typeof RadiantApiLiveHttpServerRuntime extends ManagedRuntime<infer A, any> ? A : never;
export const runEffect = async <A, E>(e: Effect.Effect<A, E, RuntimeServices | RadiantClient>) => RadiantApiLiveHttpServerRuntime.runPromise(e.pipe(Effect.provide(await inProcessApiClient(async() => new Headers(await headers())))))
