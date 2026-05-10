import { Effect, Schedule } from "effect"

// Contador simples para vermos os frames a passar
let frameCount = 0

/**
 * O efeito que simula a geração de um frame de áudio.
 */
const onTrigger = Effect.gen(function* () {
	yield* Effect.logInfo("Trigger " + ++frameCount)
})

/**
 * O teu Schedule "Rádio Comercial Style"
 */
const radioCommercialSchedule = Schedule.spaced("5 seconds")

/**
 * O Programa Principal
 */
const program = Effect.repeat(onTrigger.pipe(Effect.repeatN(100)), radioCommercialSchedule)

// Executa o teste
Effect.runPromise(program)
