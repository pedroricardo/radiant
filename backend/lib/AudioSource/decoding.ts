import { Duration, Effect, Exit, Scope, Stream } from "effect"
import { readObjectAsTempFileScoped } from "../../services/StorageService/tempFile"

import { fromAudioFile, mapStream } from "."

export const fromStorageObject = (
	key: string,
	options?: {
		readonly seek?: Duration.DurationInput
	},
) =>
	Effect.gen(function* () {
		const scope = yield* Scope.make()
		const tempPath = yield* readObjectAsTempFileScoped(key).pipe(Scope.extend(scope))

		return mapStream(yield* fromAudioFile(tempPath, options), (s) =>
			Stream.ensuring(s, Scope.close(scope, Exit.void)),
		)
	})
