# Ideas

## Per-listener connect ads

Idea:

- when a listener connects to the radio, the stream can start with a random ad
- only after that ad finishes does the listener join the normal radio stream
- this is local per listener, not global for the whole station

Why it matters:

- this matches behaviour used by real commercial radio stations
- it fits the Radiant architecture well because listeners already have per-listener stream handling in `RadioStream`
- it is a real product problem taken from actual radio operations, not an invented feature

High-level implementation direction:

- keep a pool/playlist of connect ads per radio
- on new listener connection, choose one ad for that listener
- prepend that ad before joining the shared live stream
- after the ad ends, splice the listener into the current radio position
- this must remain per-listener and must not affect the shared playout clock

Important constraints:

- ad selection may need rules later: random, weighted, capped repetition, campaign windows
- transition into the live stream should happen cleanly without breaking synchronization
- analytics may later need to count impressions per ad and per connection

Product note:

- build features by observing what real stations actually do, then solve the real operational problem
- do not invent a solution first and then go looking for a problem

## Advertising windows inside scheduled playout

Idea:

- support fixed advertising periods in the schedule
- when a playlist spans across an ad window, the system inserts the ad break into the middle of the playlist timeline
- operationally, the ad break behaves almost like another item injected into the running sequence
- the total effective duration of the playlist window increases because of the inserted ads

Why it matters:

- real stations often have commercial breaks at fixed times
- music scheduling has to bend around those breaks instead of pretending the playlist is uninterrupted
- this creates real timing constraints for programming and calendar editing

High-level implementation direction:

- define scheduled ad windows per radio
- when resolving a playlist block, detect ad windows intersecting its virtual timeline
- inject the ad break into the resolved sequence at the correct clock boundary
- continue the playlist after the break from the next valid music boundary

Important constraints:

- this changes the effective total duration of the playlist block
- playlist scheduling around ad windows must fit cleanly before and after the commercial break
- the UI should make those constraints visible when creating or resizing playlist blocks
- ad windows should probably be treated differently from manual `overlay` interruptions because they are part of planned programming

Product note:

- this is another case of following real radio operations first
- the scheduler has to model the actual clock discipline of commercial radio, not an idealized uninterrupted music timeline

### Exact fit rule around ad windows

When a playlist overlaps a scheduled advertising window, the ad window must land exactly on a playlist boundary.

That means:

- the ad window cannot start in the middle of a music track
- the dashboard should only allow playlist start times where the ad window begins exactly between two playlist items
- the UI should snap automatically to those valid start times
- the ad window should be rendered inside the playlist timeline as if it were an inserted item, but with a distinct visual treatment

Example:

- ad window: `13:30 -> 13:35`
- playlist:
  - music 1: `3m`
  - music 2: `5m`
  - music 3: `4m`

Valid accumulated boundaries before the ad window:

- `0m`
- `3m`
- `8m`

So valid playlist start times are:

- `13:30 - 0m = 13:30`
- `13:30 - 3m = 13:27`
- `13:30 - 8m = 13:22`

Depending on the product rule, starting exactly at the ad window boundary may or may not be allowed. If it is not allowed, then only `13:27` and `13:22` are valid.

Important note:

- this example ignores jingles for now
- once jingles exist, the exact same rule still applies
- the only difference is that the valid boundaries come from the effective resolved timeline, not just the plain list of songs

### Ad windows as planned transmission holes

Another useful way to think about advertising windows:

- a `JP` is basically a planned hole in the normal transmission
- the normal playlist/programming must arrive exactly at the start of that hole on a valid playlist boundary
- inside that hole, Radiant chooses ad audio files and fills the available time
- when the ad window ends, the radio returns to the normal transmission and continues from where the planned timeline should resume

Operationally:

- the station defines one or more ad audio assets eligible for those windows
- Radiant can choose ads randomly from that pool
- the ad window is not a manual interruption; it is part of planned programming
- the ad resolver should try to fill the available duration as closely as possible

Important constraints:

- the ad fill logic may later need rules such as randomization, weighting, campaign windows, cooldowns, or no-repeat constraints
- the scheduler must treat the ad window as a first-class timing constraint
- the music side of the schedule has to fit cleanly before and after the ad window

## Live sessions from the browser

Idea:

- support scheduled live blocks in the calendar
- during those blocks, Radiant listens to a live microphone source and broadcasts it
- the live block can also support background music under the microphone

Why it matters:

- real stations mix automation with live talk segments
- this lets a presenter go live without needing a separate native studio app
- it keeps the scheduling model consistent: playlists, files, ads, and live segments all live in the same calendar

High-level implementation direction:

- add a new schedule target type for live sessions
- the presenter opens the dashboard in the browser and joins the live session
- the browser captures the microphone and sends audio to the backend
- the backend turns that incoming live source into part of the radio playout
- optional bed/background music can be mixed underneath the microphone

Possible transport direction:

- WebRTC is a strong candidate because browsers already support microphone capture and realtime media transport well
- another custom low-latency streaming path could also work, but WebRTC is the obvious first thing to investigate

Important constraints:

- the live session has to become the active playout source exactly when its block starts
- there must be a clean fallback if no presenter is connected when the block begins
- latency, reconnects, mic monitoring, levels, and ducking will matter a lot
- background music under speech should be treated as a proper mix problem, not just a second unrelated source

## Media metadata editor

Idea:

- add a metadata editor in the dashboard for audio files in the media library
- allow editing fields like track title, artist, album, cover art, and related descriptive metadata
- expose the same capability through a proper backend API, not only through the UI
- add an automatic metadata suggester that searches the internet based on the filename and proposes possible matches
- keep manual editing available even when automatic suggestions exist

Why it matters:

- imported files often have incomplete, inconsistent, or wrong metadata
- radio operators need clean metadata for playlists, preview cards, now playing, and future automation rules
- fixing metadata inside Radiant is much better than forcing users to preprocess every file externally

High-level implementation direction:

- store editable metadata separately from low-level extracted technical metadata
- extracted metadata remains the initial source of truth on upload
- user-edited metadata can override display-facing fields in the dashboard and playout UI
- cover art should be uploadable/replacable from the dashboard
- the metadata editor can trigger an automatic lookup using the filename as the first search clue
- the system should present one or more metadata suggestions for review instead of silently applying them
- the operator can accept a suggestion fully, partially, or ignore it and fill everything manually

Important constraints:

- technical metadata such as duration, codec, sample rate, and channels should not be freely editable by hand
- only descriptive metadata should be editable in the dashboard
- the API should make it clear which fields are user-editable and which are system-derived
- future now playing / playlist / search features should consume the edited metadata view, not raw extractor output
- automatic suggestions should never overwrite user edits without explicit confirmation
- internet lookup will need source trust rules, confidence scoring, and a clear distinction between suggested metadata and confirmed metadata
