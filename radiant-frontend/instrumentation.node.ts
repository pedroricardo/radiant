import { HttpApiBuilder, HttpApp } from "@effect/platform";
import { RadiantApiLiveHttpServerRuntime } from "@radiant/backend";
import { Effect } from "effect"

export async function registerNodeInstrumentation() {
	if(globalThis.globalWebHandler && !globalThis.globalWebHandler.disposed) {
		return;
	}
	const mr = RadiantApiLiveHttpServerRuntime;
	const r = await RadiantApiLiveHttpServerRuntime.runtime()
	globalThis.globalWebHandler = {
		handler: async (req: Request) => {
			return HttpApp.toWebHandlerRuntime(r)(
				await HttpApiBuilder.httpApp.pipe(Effect.provide(r), Effect.runPromise),
			)(req)
		},
		dispose: () => mr.dispose().then(() => { globalWebHandler.disposed = true; }),
		runtime: r,
		disposed: false
	};
	if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
		return
	}

	const shutdown = async () => {
		await mr.runPromise(Effect.logInfo("Shutting down API"))
		await mr.dispose()
	}

	process.on("SIGINT", shutdown)
}
