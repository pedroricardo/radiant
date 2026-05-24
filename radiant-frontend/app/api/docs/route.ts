import { registerNodeInstrumentation } from "../../../instrumentation.node"

export const runtime = "nodejs"

export const GET = async (request: Request) => {
	await registerNodeInstrumentation();
	const response = await globalWebHandler.handler(new Request(new URL("/api/docs", request.url), request))
	const headers = new Headers(response.headers)

	// Swagger UI is effectively static for a deployed backend version, so cache it aggressively
	// at the HTTP layer without forcing Next.js to prerender the route at build time.
	headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400")

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}
