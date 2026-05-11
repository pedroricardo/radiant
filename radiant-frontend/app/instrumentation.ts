import { webHandler } from "@radiant/backend"

export function register() {
	if (process.env.NEXT_MANUAL_SIG_HANDLE) {
		process.on("SIGTERM", async () => {
			await webHandler.dispose()
			process.exit(0)
		})
		process.on("SIGINT", async () => {
			await webHandler.dispose()
			process.exit(0)
		})
	}
}
