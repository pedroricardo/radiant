import { webHandler } from "@radiant/backend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const providerFrom = (request: Request) => {
	const pathname = new URL(request.url).pathname
	return pathname.split("/").at(-1) ?? ""
}

export const GET = async (request: Request) => {
	const provider = providerFrom(request)
	if (provider.length === 0) {
		return new Response("Missing OAuth provider", { status: 400 })
	}

	const response = await webHandler.handler(
		new Request(
			new URL(`/api/auth/oauth/${encodeURIComponent(provider)}/url`, request.url),
			request,
		),
	)

	if (!response.ok) {
		return response
	}

	const authorizationUrl = (await response.json()) as string
	const headers = new Headers()
	headers.set("location", authorizationUrl)
	headers.set("cache-control", "no-store")

	return new Response(null, {
		status: 302,
		headers,
	})
}
