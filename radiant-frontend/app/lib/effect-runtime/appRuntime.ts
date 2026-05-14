import * as RadiantClient from "@radiant/client"
import { ManagedRuntime } from "effect"

export const appRuntimeLayer = RadiantClient.withFetch
export const appManagedRuntime = ManagedRuntime.make(appRuntimeLayer)

export type AppRuntimeServices = ManagedRuntime.ManagedRuntime.Context<typeof appManagedRuntime>
export type AppRuntimeError = ManagedRuntime.ManagedRuntime.Error<typeof appManagedRuntime>
