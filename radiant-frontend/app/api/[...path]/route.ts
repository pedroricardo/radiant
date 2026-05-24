
export const runtime = "nodejs"

const forwardToBackend = async (request: Request) => globalWebHandler.handler(request)

export const GET = forwardToBackend
export const POST = forwardToBackend
export const PUT = forwardToBackend
export const PATCH = forwardToBackend
export const DELETE = forwardToBackend
export const HEAD = forwardToBackend
export const OPTIONS = forwardToBackend
