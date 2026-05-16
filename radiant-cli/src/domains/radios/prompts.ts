import { Effect } from "effect"

import type { RadioRow } from "./repository"
import { RadioSelectionNotFoundError } from "./errors"
import * as Prompter from "../../shared/Prompter"

const formatRadioLabel = (radio: RadioRow) => `${radio.id}: ${radio.name} (${radio.timezone})`

export const promptRadio = (items: ReadonlyArray<RadioRow>) =>
	Effect.flatMap(Prompter.Prompter, (prompter) =>
		prompter.select({
			message: "Which radio should receive the block?",
			options: items.map((radio) => ({
				value: radio.id,
				label: formatRadioLabel(radio),
			})),
		}),
	).pipe(
		Effect.flatMap((radioId) =>
			Effect.fromNullable(items.find((radio) => radio.id === radioId)).pipe(
				Effect.orElseFail(() => new RadioSelectionNotFoundError({ radioId })),
			),
		),
	)
