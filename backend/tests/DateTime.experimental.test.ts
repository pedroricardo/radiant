import { describe, expect, it } from "bun:test"
import { Option } from "effect"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"

/**
 * Testes experimentais com DateTime.Zoned para Radiant
 * Focus: startMinuteOfDay, endMinuteOfDay, weekday, e DST
 */

describe("DateTime Experiments for Radiant Calendar", () => {
	// ============================================
	// HELPER FUNCTIONS
	// ============================================

	/**
	 * Converte minutos desde início do dia para hora:minuto
	 */
	const minuteOfDayToTimeString = (minuteOfDay: number): string => {
		const hours = Math.floor(minuteOfDay / 60)
		const minutes = minuteOfDay % 60
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
	}

	/**
	 * Converte hora:minuto para minutos desde início do dia
	 */
	const timeStringToMinuteOfDay = (timeStr: string): number => {
		const [hours, minutes] = timeStr.split(":").map(Number)
		return hours! * 60 + minutes!
	}

	/**
	 * Cria um DateTime.Zoned num dia específico da semana
	 */
	const createWeeklyBlockOccurrence = (
		year: number,
		month: number,
		day: number,
		startMinuteOfDay: number,
		endMinuteOfDay: number,
		timezone: string,
	) => {
		const startHours = Math.floor(startMinuteOfDay / 60)
		const startMinutes = startMinuteOfDay % 60
		const endHours = Math.floor(endMinuteOfDay / 60)
		const endMinutes = endMinuteOfDay % 60

		const start = DateTime.unsafeMakeZoned(
			{
				year,
				month,
				day,
				hours: startHours,
				minutes: startMinutes,
				seconds: 0,
			},
			{
				timeZone: timezone,
				adjustForTimeZone: true,
				disambiguation: "compatible",
			},
		)

		const end = DateTime.unsafeMakeZoned(
			{
				year,
				month,
				day,
				hours: endHours,
				minutes: endMinutes,
				seconds: 0,
			},
			{
				timeZone: timezone,
				adjustForTimeZone: true,
				disambiguation: "compatible",
			},
		)

		return { start, end }
	}

	/**
	 * Encontra próxima ocorrência de um weekday a partir de uma data
	 */
	const findNextOccurrenceOfWeekday = (
		nowUtc: DateTime.Utc,
		targetWeekday: number,
		timezone: string,
	): DateTime.Utc => {
		const nowZoned = DateTime.setZone(nowUtc, DateTime.zoneUnsafeMakeNamed(timezone))
		const nowParts = DateTime.toParts(nowZoned)
		const currentWeekday = nowParts.weekDay

		let daysToAdd = (targetWeekday - currentWeekday + 7) % 7
		if (daysToAdd === 0) {
			daysToAdd = 7 // Se é hoje, próximo é próxima semana
		}

		const nextOccurrence = DateTime.add(nowUtc, { days: daysToAdd })
		return nextOccurrence
	}

	// ============================================
	// TESTE 1: Converter minutos para hora:minuto
	// ============================================

	describe("Minute of Day Conversion", () => {
		it("should convert 0 minutes to 00:00", () => {
			expect(minuteOfDayToTimeString(0)).toBe("00:00")
		})

		it("should convert 870 minutes to 14:30", () => {
			expect(minuteOfDayToTimeString(870)).toBe("14:30")
		})

		it("should convert 1439 minutes to 23:59", () => {
			expect(minuteOfDayToTimeString(1439)).toBe("23:59")
		})

		it("should convert time string back to minutes", () => {
			expect(timeStringToMinuteOfDay("14:30")).toBe(870)
			expect(timeStringToMinuteOfDay("00:00")).toBe(0)
			expect(timeStringToMinuteOfDay("23:59")).toBe(1439)
		})
	})

	// ============================================
	// TESTE 2: Bloco num dia específico sem DST
	// ============================================

	describe("Weekly Block on Specific Day (No DST)", () => {
		it("should create a block on Monday without DST", () => {
			// 27 de Janeiro de 2025 é segunda-feira
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				1,
				27, // Monday
				14 * 60 + 30, // 14:30
				15 * 60 + 45, // 15:45
				"Europe/Lisbon",
			)

			const startParts = DateTime.toParts(start)
			const endParts = DateTime.toParts(end)

			// Verifica dia
			expect(startParts.day).toBe(27)
			expect(endParts.day).toBe(27)

			// Verifica hora
			expect(startParts.hours).toBe(14)
			expect(startParts.minutes).toBe(30)
			expect(endParts.hours).toBe(15)
			expect(endParts.minutes).toBe(45)

			// Verifica duração
			const duration = DateTime.distanceDuration(start, end)
			expect(Duration.toMinutes(duration)).toBe(75)
		})

		it("should handle block spanning midnight", () => {
			// Bloco de 23:00 a 01:00 (próximo dia)
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				1,
				27, // Monday 23:00
				23 * 60, // 23:00
				25 * 60, // 25:00 = 01:00 do dia seguinte (vai falhar!)
				"Europe/Lisbon",
			)

			const startParts = DateTime.toParts(start)
			// 25 horas não é válido!
			// Isto testa o comportamento com input inválido
		})

		it("should correctly calculate offset in winter (UTC+0)", () => {
			// Janeiro em Lisbon é UTC+0 (sem DST)
			const { start } = createWeeklyBlockOccurrence(
				2025,
				1,
				27,
				14 * 60 + 30,
				15 * 60 + 45,
				"Europe/Lisbon",
			)

			const offset = DateTime.zonedOffset(start)
			expect(offset).toBe(0) // UTC+0
		})

		it("should correctly calculate offset in summer (UTC+1)", () => {
			// Julho em Lisbon é UTC+1 (DST)
			const { start } = createWeeklyBlockOccurrence(
				2025,
				7,
				28, // Monday in July
				14 * 60 + 30,
				15 * 60 + 45,
				"Europe/Lisbon",
			)

			const offset = DateTime.zonedOffset(start)
			expect(offset).toBe(3600000) // UTC+1 (1 hora em ms)
		})
	})

	// ============================================
	// TESTE 3: Comparar blocos no mesmo dia
	// ============================================

	describe("Block Comparisons on Same Day", () => {
		it("should correctly order two blocks", () => {
			const { start: block1Start } = createWeeklyBlockOccurrence(
				2025,
				1,
				27,
				14 * 60,
				15 * 60,
				"Europe/Lisbon",
			)

			const { start: block2Start } = createWeeklyBlockOccurrence(
				2025,
				1,
				27,
				16 * 60,
				17 * 60,
				"Europe/Lisbon",
			)

			expect(DateTime.lessThan(block1Start, block2Start)).toBe(true)
			expect(DateTime.greaterThan(block2Start, block1Start)).toBe(true)
		})

		it("should detect if now is within a block", () => {
			// Criar um bloco de 14:00-15:00 em Lisboa
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				1,
				27,
				14 * 60,
				15 * 60,
				"Europe/Lisbon",
			)

			// Criar um tempo dentro do bloco: 14:30
			const nowInBlock = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 14,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			expect(DateTime.greaterThanOrEqualTo(nowInBlock, start)).toBe(true)
			expect(DateTime.lessThan(nowInBlock, end)).toBe(true)

			// Criar um tempo fora do bloco: 15:30
			const nowAfterBlock = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 15,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			expect(DateTime.greaterThanOrEqualTo(nowAfterBlock, end)).toBe(true)
		})
	})

	// ============================================
	// TESTE 4: Encontrar próxima ocorrência (weekday)
	// ============================================

	describe("Finding Next Occurrence of Weekday", () => {
		it("should find next Monday from Sunday", () => {
			// 26 de Janeiro de 2025 é domingo
			const sunday = DateTime.unsafeMake("2025-01-26T10:00:00Z")

			// Procura próxima segunda-feira (weekday: 1)
			const nextMonday = findNextOccurrenceOfWeekday(sunday, 1, "Europe/Lisbon")
			const mondayParts = DateTime.toParts(
				DateTime.setZone(nextMonday, DateTime.zoneUnsafeMakeNamed("Europe/Lisbon")),
			)

			expect(mondayParts.day).toBe(27)
			expect(mondayParts.weekDay).toBe(1) // Monday
		})

		it("should find next week if today is the target weekday", () => {
			// 27 de Janeiro é segunda-feira
			const monday = DateTime.unsafeMake("2025-01-27T10:00:00Z")

			// Procura próxima segunda-feira
			const nextMonday = findNextOccurrenceOfWeekday(monday, 1, "Europe/Lisbon")
			const nextMondayParts = DateTime.toParts(
				DateTime.setZone(nextMonday, DateTime.zoneUnsafeMakeNamed("Europe/Lisbon")),
			)

			// Deve ser próxima segunda-feira (3 de Fevereiro)
			expect(nextMondayParts.day).toBe(3)
		})

		it("should correctly identify weekday numbers", () => {
			// 27 de Janeiro de 2025 é segunda-feira
			const monday = DateTime.unsafeMake("2025-01-27T10:00:00Z")
			const mondayZoned = DateTime.setZone(monday, DateTime.zoneUnsafeMakeNamed("Europe/Lisbon"))
			const mondayParts = DateTime.toParts(mondayZoned)

			expect(mondayParts.weekDay).toBe(1) // 0=Sunday, 1=Monday, ..., 6=Saturday
		})
	})

	// ============================================
	// TESTE 5: DST - GAP (Spring Forward)
	// ============================================

	describe("DST - Gap Time (Spring Forward)", () => {
		it("should handle gap time with compatible strategy", () => {
			// 26 de Março de 2025: Gap entre 02:00 e 03:00
			// 02:30 não existe, deve resolver para 03:30

			const gapTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 3,
					day: 30,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			const resolved = Option.getOrThrow(gapTime)
			const parts = DateTime.toParts(resolved)

			// Deve resolver para 02:30 (after the gap)
			expect(parts.hours).toBe(2)
			expect(parts.minutes).toBe(30)
		})

		it("should handle gap time with earlier strategy", () => {
			// Com "earlier", deve resolver para antes do gap (01:30)
			const gapTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 3,
					day: 30,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "earlier",
				},
			)
			const resolved = Option.getOrThrow(gapTime)

			const parts = DateTime.toParts(resolved)

			expect(parts.hours).toBe(0)
			expect(parts.minutes).toBe(30)
		})

		it("should reject gap time with reject strategy", () => {
			const gapTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 3,
					day: 30,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "reject",
				},
			)

			// Deve retornar None (ou falhar)
			expect(gapTime._tag).toBe("None")
		})

		it("should correctly detect DST transition via offset change", () => {
			// Antes do gap (00:59)
			const beforeGap = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 30,
					hours: 0,
					minutes: 59,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			// Depois do gap (02:00)
			const afterGap = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 30,
					hours: 2,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			const beforeOffset = DateTime.zonedOffset(beforeGap)
			const afterOffset = DateTime.zonedOffset(afterGap)

			// Offsets devem ser diferentes
			expect(beforeOffset).not.toBe(afterOffset)
			expect(beforeOffset).toBe(0) // WET (UTC+0)
			expect(afterOffset).toBe(3600000) // CEST (UTC+1)
		})
	})

	// ============================================
	// TESTE 6: DST - AMBIGUOUS (Fall Back)
	// ============================================

	describe("DST - Ambiguous Time (Fall Back)", () => {
		it("should handle ambiguous time with compatible strategy", () => {
			// 26 de Outubro de 2025: 02:30 ocorre duas vezes
			// "compatible" escolhe a primeira ocorrência

			const ambiguousTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 10,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)
			const resolved = Option.getOrThrow(ambiguousTime)

			// Primeira ocorrência = CEST (UTC+1)
			const offset = DateTime.zonedOffset(resolved)
			expect(offset).toBe(3600000) // UTC+1
		})

		it("should handle ambiguous time with earlier strategy", () => {
			// "earlier" = primeira ocorrência
			const ambiguousTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 10,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "earlier",
				},
			)
			const resolved = Option.getOrThrow(ambiguousTime)

			const offset = DateTime.zonedOffset(resolved)

			expect(offset).toBe(3600000) // UTC+1 (CEST)
		})

		it("should handle ambiguous time with later strategy", () => {
			// "later" = segunda ocorrência
			const ambiguousTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 10,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "later",
				},
			)
			const resolved = Option.getOrThrow(ambiguousTime)

			const offset = DateTime.zonedOffset(resolved)

			expect(offset).toBe(0) // UTC+0 (WET)
		})

		it("should reject ambiguous time with reject strategy", () => {
			const ambiguousTime = DateTime.makeZoned(
				{
					year: 2025,
					month: 10,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "reject",
				},
			)

			expect(ambiguousTime._tag).toBe("None")
		})
	})

	// ============================================
	// TESTE 7: Bloco Atravessando DST (Spring)
	// ============================================

	describe("Block Crossing DST - Spring Forward", () => {
		it("should calculate correct duration when block crosses DST gap", () => {
			// Bloco de 01:00 a 04:00 no dia do gap
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				3,
				30, // Wednesday, DST day
				0 * 60, // 00:00
				3 * 60, // 03:00 (local)
				"Europe/Lisbon",
			)

			// Duration em UTC
			const duration = DateTime.distanceDuration(start, end)
			const durationHours = Duration.toHours(duration)

			// Visualmente parecem 3 horas, mas em UTC são 2 horas
			expect(durationHours).toBeCloseTo(2)

			// Verifica os offsets
			const startOffset = DateTime.zonedOffset(start)
			const endOffset = DateTime.zonedOffset(end)

			expect(startOffset).toBe(0) // UTC+0 antes do gap
			expect(endOffset).toBe(3600000) // UTC+1 depois do gap
		})

		it("should handle block entirely before DST transition", () => {
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				3,
				26,
				0 * 60, // 00:00
				1 * 60, // 01:00 (antes do gap)
				"Europe/Lisbon",
			)

			const duration = DateTime.distanceDuration(start, end)
			const durationHours = Duration.toHours(duration)

			// Exactamente 1 hora
			expect(durationHours).toBe(1)
		})

		it("should handle block entirely after DST transition", () => {
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				3,
				26,
				3 * 60, // 03:00 (depois do gap)
				5 * 60, // 05:00
				"Europe/Lisbon",
			)

			const duration = DateTime.distanceDuration(start, end)
			const durationHours = Duration.toHours(duration)

			// Exactamente 2 horas
			expect(durationHours).toBe(2)
		})
	})

	// ============================================
	// TESTE 8: Bloco Atravessando DST (Fall)
	// ============================================

	describe("Block Crossing DST - Fall Back", () => {
		it("should calculate correct duration when block crosses DST ambiguous time", () => {
			// Bloco de 01:00 a 04:00 no dia de queda de DST
			const { start, end } = createWeeklyBlockOccurrence(
				2025,
				10,
				26, // Sunday, DST fall back
				1 * 60, // 01:00
				4 * 60, // 04:00
				"Europe/Lisbon",
			)

			const duration = DateTime.distanceDuration(start, end)
			const durationHours = Duration.toHours(duration)

			// Visualmente parecem 3 horas, mas em UTC são 4 horas!
			expect(durationHours).toBeCloseTo(4)

			const startOffset = DateTime.zonedOffset(start)
			const endOffset = DateTime.zonedOffset(end)

			expect(startOffset).toBe(3600000) // UTC+1 (CEST, primeira ocorrência)
			expect(endOffset).toBe(0) // UTC+0 (WET)
		})
	})

	// ============================================
	// TESTE 9: Adicionar Duração (CUIDADO com DST!)
	// ============================================

	describe("Adding Duration (Beware of DST!)", () => {
		it("should add 2 hours using addDuration", () => {
			const start = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 14,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			const plusTwoHours = DateTime.addDuration(start, Duration.hours(2))
			const plusTwoHoursParts = DateTime.toParts(plusTwoHours)

			expect(plusTwoHoursParts.hours).toBe(16)
			expect(plusTwoHoursParts.minutes).toBe(30)
		})

		it("should NOT correctly add 24 hours across DST gap", () => {
			// Problema: addDuration adiciona ms literalmente
			const before = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			// ❌ Adiciona 24 horas em ms (89,999,999ms literalmente)
			const after = DateTime.addDuration(before, Duration.hours(24))
			const afterParts = DateTime.toParts(after)

			// Vamos ver o que acontece...
			console.log("Before:", DateTime.toParts(before))
			console.log("After adding 24h:", afterParts)

			// Provavelmente NÃO será 01:30 do próximo dia!
			// Será algo como 00:30 porque o gap "comeu" 1 hora
		})

		it("should correctly add 1 day using add() with days", () => {
			const before = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			// ✅ add({ days: 1 }) cuida de DST
			const nextDay = DateTime.add(before, { days: 1 })
			const nextDayParts = DateTime.toParts(nextDay)

			// Deve ser 01:30 do próximo dia
			expect(nextDayParts.hours).toBe(1)
			expect(nextDayParts.minutes).toBe(30)
			expect(nextDayParts.day).toBe(27)
		})
	})

	// ============================================
	// TESTE 10: Comparar Blocos em Diferentes Timezones
	// ============================================

	describe("Comparing Blocks in Different Timezones", () => {
		it("should correctly compare same absolute time in different timezones", () => {
			// 14:00 em New York
			const nyTime = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 14,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "America/New_York",
					adjustForTimeZone: true,
				},
			)

			// 19:00 em Lisboa (mesmo momento UTC)
			const lisbonTime = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 19,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			// Devem ter o mesmo epochMillis
			expect(nyTime.epochMillis).toBe(lisbonTime.epochMillis)

			// comparações devem ser iguais
			expect(DateTime.lessThan(nyTime, lisbonTime)).toBe(false)
			expect(DateTime.greaterThan(nyTime, lisbonTime)).toBe(false)
			expect(DateTime.lessThanOrEqualTo(nyTime, lisbonTime)).toBe(true)
			expect(DateTime.greaterThanOrEqualTo(nyTime, lisbonTime)).toBe(true)
		})

		it("should correctly calculate distance across timezones", () => {
			const nyTime = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 14,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "America/New_York",
					adjustForTimeZone: true,
				},
			)

			const lisbonTime = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 15,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			const distance = DateTime.distanceDuration(nyTime, lisbonTime)
			const distanceHours = Duration.toHours(distance)

			// 15:00 Lisbon = 10:00 NY (4 horas depois)
			expect(distanceHours).toBeCloseTo(4)
		})
	})

	// ============================================
	// TESTE 11: Próximo Checkpoint com DST
	// ============================================

	describe("Calculating Next Checkpoint", () => {
		it("should find next checkpoint after current block", () => {
			// Agora: 14:30 em segunda-feira
			const now = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 14,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			// Bloco termina às 15:45
			const blockEnd = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 1,
					day: 27,
					hours: 15,
					minutes: 45,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
				},
			)

			// Próximo checkpoint = fim do bloco
			const nextCheckpoint = DateTime.toEpochMillis(blockEnd)
			const nowMs = DateTime.toEpochMillis(now)

			expect(nextCheckpoint).toBeGreaterThan(nowMs)
			const delayMs = nextCheckpoint - nowMs
			expect(delayMs).toBeCloseTo(75 * 60 * 1000) // 75 minutos em ms
		})

		it("should handle checkpoint spanning DST", () => {
			// Agora: 01:30 no dia da mudança de DST
			const now = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 26,
					hours: 1,
					minutes: 30,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			// Bloco termina às 04:00 (após gap)
			const blockEnd = DateTime.unsafeMakeZoned(
				{
					year: 2025,
					month: 3,
					day: 26,
					hours: 4,
					minutes: 0,
					seconds: 0,
				},
				{
					timeZone: "Europe/Lisbon",
					adjustForTimeZone: true,
					disambiguation: "compatible",
				},
			)

			const delayMs = DateTime.toEpochMillis(blockEnd) - DateTime.toEpochMillis(now)

			// Visualmente parecem 2.5 horas, mas em ms são 2.5 horas literais
			const delayHours = delayMs / (60 * 60 * 1000)
			expect(delayHours).toBeCloseTo(2.5)
		})
	})

	// ============================================
	// TESTE 12: Real-World Scenario
	// ============================================

	describe("Real-World Scenario", () => {
		it("should handle a full week schedule with DST", () => {
			// Criar blocos para uma semana que inclui transição de DST
			// (26 de Março é quarta-feira)

			const blocks = [
				{
					weekday: 1, // Monday
					startMinuteOfDay: 14 * 60,
					endMinuteOfDay: 15 * 60,
				},
				{
					weekday: 3, // Wednesday (DST day)
					startMinuteOfDay: 1 * 60,
					endMinuteOfDay: 4 * 60,
				},
				{
					weekday: 5, // Friday
					startMinuteOfDay: 19 * 60,
					endMinuteOfDay: 21 * 60,
				},
			]

			// Simular: estamos em domingo 23 de Março, 10:00 UTC
			const sunday23March = DateTime.unsafeMake("2025-03-23T10:00:00Z")

			// Processar cada bloco da semana
			blocks.forEach((block) => {
				const nextOccurrence = findNextOccurrenceOfWeekday(
					sunday23March,
					block.weekday,
					"Europe/Lisbon",
				)

				const zoned = DateTime.setZone(
					nextOccurrence,
					DateTime.zoneUnsafeMakeNamed("Europe/Lisbon"),
				)
				const parts = DateTime.toParts(zoned)

				expect(parts.weekDay).toBe(block.weekday)
			})
		})
	})
	it("should add calendar hour into a DST gap", () => {
		const beforeGap = DateTime.unsafeMakeZoned(
			{
				year: 2025,
				month: 3,
				day: 30,
				hours: 0,
				minutes: 30,
				seconds: 0,
			},
			{
				timeZone: "Europe/Lisbon",
				adjustForTimeZone: true,
				disambiguation: "compatible",
			},
		)

		const calendarAdded = DateTime.add(beforeGap, { hours: 1 })
		const durationAdded = DateTime.addDuration(beforeGap, Duration.hours(1))

		expect(DateTime.toParts(calendarAdded).hours).toBe(2)
		expect(DateTime.toParts(calendarAdded).minutes).toBe(30)

		expect(DateTime.toEpochMillis(calendarAdded)).toBe(DateTime.toEpochMillis(durationAdded))
	})
})
