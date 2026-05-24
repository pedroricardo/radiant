
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

	const sourceUrl = new URL(request.url)
	const targetUrl = new URL(
		`/api/auth/oauth/${encodeURIComponent(provider)}/callback${sourceUrl.search}`,
		request.url,
	)

	const response = await globalWebHandler.handler(new Request(targetUrl, request))
	if (!response.ok) {
		return response
	}

	const headers = new Headers()
	const setCookie = response.headers.get("set-cookie")
	if (setCookie) {
		headers.set("set-cookie", setCookie)
	}
	headers.set("location", "/")
	headers.set("cache-control", "no-store")

	return new Response(null, {
		status: 302,
		headers,
	})
}
