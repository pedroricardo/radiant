# Radiant Design System

## Visual Direction

Radiant uses a control-room flavored neo-brutalist system:

- hard borders
- flat, loud surfaces
- dry shadows
- display typography for impact
- technical typography for labels and dense UI
- strong semantic color coding for live, warning, success, and structure

The goal is not generic SaaS polish. The goal is software that feels like a broadcast console.

## Product Areas Driving the UI

Based on `PLAYOUT_MANAGER_PLAN.md`, the dashboard needs to support:

- radio overview
- weekly playout calendar
- one-off schedule overrides
- media library / VFS
- playlist editing
- interruption/live controls
- stream health and observability
- upload and metadata workflows

That means the design system needs primitives for:

- hierarchy and navigation
- dense information display
- drag/drop and timeline editing
- status communication
- media-centric controls

## Semantic Tokens

These are the semantic pillars of the UI theme:

- `canvas`: app/page background
- `surface`: default panel background
- `surface-muted`: secondary panels and embedded zones
- `surface-strong`: dark high-contrast blocks
- `surface-live`: live/on-air emphasis
- `surface-accent`: product accent panels
- `ink`: strongest border and text color
- `ink-soft`: secondary text and low-emphasis labels
- `signal`: primary brand/accent color
- `signal-warm`: warm accent for handles, knobs, focus moments
- `signal-live`: live state / urgent attention
- `signal-info`: cool informative surface
- `signal-success`: stable/healthy/synced state

## Typography Roles

- `display`: hero titles, section statements, strong product moments
- `sans`: general UI copy, forms, tables, cards
- `mono`: technical labels, timings, statuses, metadata, compact counters

## Core Primitive Components

These should exist as reusable UI building blocks:

- `Button`
- `Badge`
- `Card`
- `Field`
- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `Switch`
- `Tabs`
- `Dialog`
- `Popover`
- `Tooltip`
- `DropdownMenu`
- `ScrollArea`
- `Separator`
- `Table`
- `EmptyState`
- `Skeleton`

## Dashboard-Specific Primitives

These are not page-specific; they are reusable product primitives:

- `AppShell`
- `SidebarNav`
- `PageHeader`
- `SectionHeader`
- `Toolbar`
- `MetricCard`
- `StatusPill`
- `StatList`
- `VolumeSliderVertical`
- `TransportPreviewCard`
- `CoverArt`

## Media Library Components

- `Tree`
- `TreeItem`
- `FileNodeRow`
- `FolderNodeRow`
- `SelectionBar`
- `UploadDropzone`
- `MediaMetaCard`
- `AudioWaveformPreview`

## Schedule / Calendar Components

- `TimeRuler`
- `ScheduleGrid`
- `ScheduleLane`
- `ScheduleBlock`
- `ScheduleBlockHandle`
- `ScheduleConflictBadge`
- `WeeklyCalendarHeader`
- `CurrentTimeIndicator`
- `BlockInspector`

## Playlist Components

- `PlaylistTrackRow`
- `PlaylistJingleRow`
- `PlaylistList`
- `ReorderHandle`
- `DurationChip`
- `CrossfadeControl`
- `ShuffleModeControl`

## Operations / Runtime Components

- `NowPlayingCard`
- `NextUpBar`
- `StreamHealthPanel`
- `ListenerStatCard`
- `BackPressureMeter`
- `OutputRouteList`
- `InterruptionControl`
- `LiveTakeoverBar`

## Interaction Rules

- borders should use semantic border utilities, not raw black values
- shadows should come from named panel/control tokens
- status colors must communicate meaning, not decoration
- draggable things should have obvious handles or hot-zones
- dense technical UI should prefer `mono` labels and compact spacing
- layout primitives should handle wrapping early instead of collapsing too late

## Build Order

Recommended order for dashboard implementation:

1. primitives: `Button`, `Badge`, `Card`, `Field`, `Input`, `Separator`
2. app shell: `SidebarNav`, `PageHeader`, `Toolbar`
3. operational widgets: `StatusPill`, `MetricCard`, `NowPlayingCard`, `StreamHealthPanel`
4. media library: `Tree`, `FileNodeRow`, `UploadDropzone`
5. scheduler: `TimeRuler`, `ScheduleGrid`, `ScheduleBlock`
6. playlist editing: `PlaylistTrackRow`, `CrossfadeControl`, `ShuffleModeControl`

## Notes

- the current home page is already a valid visual seed for the dashboard
- new primitives should prefer shadcn-like ergonomics
- semantic Tailwind tokens should be used instead of hardcoded colors whenever possible
