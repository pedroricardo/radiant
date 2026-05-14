"use client"

import { createContext, use, useMemo } from "react"
import { Effect, ManagedRuntime } from "effect"

export function createManagedRuntimeContext<R, ER>(name: string) {
	const RuntimeContext = createContext<ManagedRuntime.ManagedRuntime<R, ER> | null>(null)
	RuntimeContext.displayName = `${name}Context`

	function Provider(props: {
		runtime: ManagedRuntime.ManagedRuntime<R, ER>
		children: React.ReactNode
	}) {
		return <RuntimeContext value={props.runtime}>{props.children}</RuntimeContext>
	}

	function useManagedRuntime() {
		const runtime = use(RuntimeContext)
		if (runtime == null) {
			throw new Error(`${name} provider is missing in the current React tree`)
		}
		return runtime
	}

	function useRunEffect() {
		const runtime = useManagedRuntime()

		return useMemo(
			() =>
				<A, E>(effect: Effect.Effect<A, E, R>, options?: { readonly signal?: AbortSignal | undefined }) =>
					runtime.runPromise(effect, options),
			[runtime],
		)
	}

	return {
		Provider,
		useManagedRuntime,
		useRunEffect,
		Context: RuntimeContext,
	} as const
}
