# Radiant

Radiant is a web platform for building and operating internet radio stations.

The project is split into a Bun/Effect backend, a Next.js frontend, and a shared client package generated around the Effect HTTP API contract. The long-term goal is a system where a station can be scheduled, mixed, previewed, and streamed from the browser without depending on a traditional local playout setup.

## Status

Radiant is still under active development.

What already exists in this repository:

- Next.js frontend running on Bun
- Effect HTTP API embedded behind the Next.js app
- shared `@radiant/client` package for contracts and typed API access
- Swagger docs exposed at `/api/docs`
- early homepage and UI/design-system work
- core radio/audio services under the backend workspace

## Repository Structure

```text
.
├── RadiantClient/     # shared API contract and typed client package
├── backend/           # Effect HTTP API, auth, radio services, DB layers
├── radiant-frontend/  # Next.js app, homepage, UI components
├── PLAYOUT_MANAGER_PLAN.md
└── README.md
```

## Architecture

### `radiant-frontend`

The frontend is a Next.js app that runs with Bun:

- serves the main website and future dashboard
- handles auth/session UI
- exposes a catch-all route for `/api/*`
- calls the backend in-process through the exported `webHandler`
- imports `@radiant/backend` and `@radiant/client` from the same workspace

### `backend`

The backend is built with Effect and `@effect/platform`:

- defines the HTTP API from the shared contract
- exports a `webHandler` with `handler(request) -> Response`
- does not open its own standalone HTTP server for the API
- is embedded into the Next.js app by turning the Effect API into a web handler function
- is invoked from the frontend catch-all API route instead of through a second local server
- mounts Swagger at `/api/docs`
- contains services for auth, radios, audio runtime, and database access

### `RadiantClient`

This package is the shared contract layer:

- exports the Effect `HttpApi` contract
- exports shared domain types
- allows the frontend and backend to stay aligned without duplicating API shapes

## Development

### Requirements

- Bun
- Node-compatible tooling available through Bun
- PostgreSQL or the local test-container workflow you are using for development

### Install

```bash
bun install
```

### Run the app

From the repository root:

```bash
bun run dev
```

This starts the Next.js app in `radiant-frontend`.

Open:

- app: `http://localhost:3000`
- API docs: `http://localhost:3000/api/docs`

### Build

```bash
bun run build
```

### Start production build

```bash
bun run start
```

### Typecheck

```bash
bun run typecheck
```

You can also typecheck each workspace separately:

```bash
bun run typecheck:backend
bun run typecheck:frontend
```

## Current Focus

Some of the main directions already being explored in the repo:

- radio homepage and dashboard design system
- playout manager and schedule model
- preview player UI
- typed frontend/backend integration through Effect HTTP
- audio pipeline pieces such as playout, multiplexing, streaming, and encoding

## Notes

- `PLAYOUT_MANAGER_PLAN.md` contains the current planning work for the scheduling side of the system.
- `radiant-frontend/README.md` is still the default Next.js scaffold README and can be cleaned up later.
