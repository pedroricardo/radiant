import * as clackPrompts from "@clack/prompts"
import { Context, Effect, Layer, Schema } from "effect"

export class PromptCanceledError extends Schema.TaggedError<PromptCanceledError>()(
	"PromptCanceledError",
	{
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Operation cancelled."),
		),
	},
) {}

export class PromptExecutionError extends Schema.TaggedError<PromptExecutionError>()(
	"PromptExecutionError",
	{
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "The interactive prompt failed."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export interface SelectOption<A> {
	readonly value: A
	readonly label: string
	readonly hint?: string | undefined
}

export interface SelectOptions<A> {
	readonly message: string
	readonly options: ReadonlyArray<SelectOption<A>>
	readonly initialValue?: A | undefined
}

export interface TextOptions {
	readonly message: string
	readonly placeholder?: string | undefined
	readonly validate?: ((value: string | undefined) => string | undefined) | undefined
	readonly initialValue?: string | undefined
}

export interface ConfirmOptions {
	readonly message: string
	readonly initialValue?: boolean | undefined
}

const asPrompt = <A>(promise: () => Promise<A | symbol>) =>
	Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: promise,
			catch: (cause) => new PromptExecutionError({ cause }),
		})

		if (clackPrompts.isCancel(result)) {
			return yield* new PromptCanceledError()
		}

		return result
	})

export class Prompter extends Context.Tag("Prompter")<
	Prompter,
	{
		readonly intro: (message: string) => Effect.Effect<void>
		readonly outro: (message: string) => Effect.Effect<void>
		readonly select: <A>(
			options: SelectOptions<A>,
		) => Effect.Effect<A, PromptCanceledError | PromptExecutionError>
		readonly text: (
			options: TextOptions,
		) => Effect.Effect<string, PromptCanceledError | PromptExecutionError>
		readonly confirm: (
			options: ConfirmOptions,
		) => Effect.Effect<boolean, PromptCanceledError | PromptExecutionError>
	}
>() {}

export const clack = Layer.succeed(Prompter, {
	intro: (message) => Effect.sync(() => clackPrompts.intro(message)),
	outro: (message) => Effect.sync(() => clackPrompts.outro(message)),
	select: <A>(options: SelectOptions<A>) =>
		asPrompt(async () =>
			clackPrompts.select<A>({
				message: options.message,
				options: options.options.map(
					(option) =>
						({
							value: option.value,
							label: option.label,
							hint: option.hint,
							disabled: false,
						}) as clackPrompts.Option<A>,
				),
				initialValue: options.initialValue,
			}),
		),
	text: (options: TextOptions) =>
		asPrompt(async () =>
			clackPrompts.text({
				message: options.message,
				placeholder: options.placeholder,
				validate: options.validate,
				defaultValue: options.initialValue,
			}),
		),
	confirm: (options: ConfirmOptions) =>
		asPrompt(async () =>
			clackPrompts.confirm({
				message: options.message,
				initialValue: options.initialValue,
			}),
		),
})
