"use client"

import { createManagedRuntimeContext } from "./createManagedRuntimeContext"
import { appManagedRuntime, type AppRuntimeError, type AppRuntimeServices } from "./appRuntime"

const appRuntimeReact = createManagedRuntimeContext<AppRuntimeServices, AppRuntimeError>("AppRuntime")

export const AppRuntimeProvider = (props: { children: React.ReactNode }) => (
	<appRuntimeReact.Provider runtime={appManagedRuntime}>{props.children}</appRuntimeReact.Provider>
)

export const useAppManagedRuntime = appRuntimeReact.useManagedRuntime
export const useRunAppEffect = appRuntimeReact.useRunEffect
