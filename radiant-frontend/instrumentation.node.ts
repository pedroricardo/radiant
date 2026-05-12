import { webHandler } from "@radiant/backend"
import { Effect } from "effect"

export async function registerNodeInstrumentation() {
	if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
		return
	}

	const shutdown = async () => {
		await webHandler.runtime.runPromise(Effect.logInfo("Shutting down API"))
		await webHandler.dispose()
		process.exit(0)
	}

	process.on("SIGTERM", shutdown)
	process.on("SIGINT", shutdown)
}
