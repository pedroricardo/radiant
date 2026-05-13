# Implementation Notes

## Media Library metadata extraction strategy

The media library will eventually need rich audio metadata during upload, especially:

- `durationMs`
- format / container
- codec
- sample rate
- channels
- bitrate
- mime type
- file size

The most important field is `durationMs`, because the schedule/calendar uses audio duration as part of its real timing model.

Planned extraction strategy:

1. try `music-metadata` first
2. if that fails or misses critical fields, try a WASM-based extractor such as `mediainfo.js`
3. use `ffprobe` only as a last resort

Why this direction:

- avoid making external process spawn the default path
- keep the common upload path inside the Node/Bun process
- still preserve a robust fallback path for strange files

Upload behavior requirement:

- metadata extraction should happen while the backend is receiving the uploaded bytes whenever possible
- if the system cannot identify the file as valid audio or cannot extract the critical metadata it needs, the upload should fail fast
- invalid files should be rejected as part of the request instead of being accepted and fixed later

At minimum, the upload path should consider the file invalid if it cannot determine the fields that are essential for scheduling, especially `durationMs`.

This note is for the future upload pipeline. The storage service is not implemented yet.
