# radiant-frontend

This is the Next.js frontend for Radiant.

It is responsible for:

- rendering the public site and future dashboard
- handling page routing and UI composition
- serving the API through Next.js route handlers
- calling the Effect backend in-process through `@radiant/backend`

## Important Detail

This app does not talk to a separate local API server during normal development.

Instead:

- Next.js owns the HTTP server
- `/api/*` is handled by route handlers inside this app
- those route handlers call the backend `webHandler`
- the backend runs in-process, on the same origin

## Scripts

From this folder:

```bash
bun run dev
bun run build
bun run start
```

## Workspace Dependencies

This workspace imports:

- `@radiant/backend`
- `@radiant/client`

So the frontend, backend, and shared API contract stay in the same monorepo and evolve together.
