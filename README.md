# Radiant

Radiant is a web platform for building and operating internet radio stations.

## Vision

Creating a radio station should be easy.

Today, putting a station on air often means stitching together legacy media servers, configuration-heavy tooling, and specialized broadcast software such as Icecast or Liquidsoap. That stack is powerful, but it is also far more complicated than it should be for many real use cases.

Radiant exists to simplify that.

The goal is to make radio creation and operation accessible through a modern web product:

- an indie station opened to the world
- a store radio instead of relying on Spotify
- a private station shared with friends
- a community or niche curation project

Radiant is meant to take the hard parts of scheduling, playout, streaming, and runtime coordination and turn them into something much easier to operate from the browser.

The project is split into a Bun/Effect backend, a Next.js frontend, and a shared client package generated around the Effect HTTP API contract. The long-term goal is a system where a station can be scheduled, mixed, previewed, and streamed from the browser without depending on a traditional local playout setup.

## Core Model

The core of Radiant is not the stream URL. It is the schedule.

The main interface of the product is the station calendar: a time-based view of what should be on air, when it should happen, and how the playout engine should behave around it.

At the center of the system are four foundational concepts:

- media files stored in a per-radio virtual library
- playlists built from those files
- schedule blocks placed on the calendar
- interruptions that can temporarily override normal playout

In practice, this means the MVP is built around:

- music and audio files
- playlists
- a station schedule/calendar
- manual interruptions

Everything else is layered on top of that foundation.

### Why the Calendar Matters

For Radiant, the calendar is the real control surface of the station.

It is where you express:

- what should be playing right now
- what should happen later in the day or week
- when a playlist should stretch, loop, or stop
- where special events or interruptions take over

The playout engine then resolves that schedule against the current clock and the radio timezone to determine the exact content and offset that should be on air at any moment.

### Playlist Timing Rules

Radiant treats playlist timing as a real broadcast problem, not as a loose visual block on a canvas.

- only playlist blocks are resizable
- direct audio-file blocks have fixed duration
- the smallest normal unit of time is a full music track
- a playlist block cannot cut a song in half
- resizing a playlist snaps to valid music boundaries from the resolved playlist timeline
- only an interruption can preempt in the middle of a track

### Audio Integrity Rule

No matter what happens, no song, ad, or other scheduled audio file can be interrupted unless the interruption system is explicitly used.

Radiant should always validate and preserve the integrity of scheduled audio:

- no collisions between scheduled items
- no cropping in the middle of a song
- no cutting an ad or audio file in half during normal scheduling
- no silent corruption of the timeline just to satisfy a visual block boundary

This is important because real stations often need exact timing while still respecting the integrity of the audio.

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
