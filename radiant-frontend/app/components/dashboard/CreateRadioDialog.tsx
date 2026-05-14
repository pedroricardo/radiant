"use client"

import { useAtomSet } from "@effect-atom/atom-react"
import { Exit } from "effect"
import { useId, useState } from "react"

import { createRadioAtom, radioListReactivityKey } from "../../lib/atoms/radiantClient"
import { groteskFont } from "../../lib/fonts"
import { Button } from "../ui/Button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/Dialog"
import { Input } from "../ui/Input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select"
import { Switch } from "../ui/Switch"
import { Textarea } from "../ui/Textarea"

const fallbackTimezones = [
	"UTC",
	"Europe/Lisbon",
	"Europe/London",
	"America/New_York",
	"Asia/Tokyo",
]

const getAvailableTimezones = () => {
	if (typeof Intl.supportedValuesOf === "function") {
		return Intl.supportedValuesOf("timeZone")
	}

	return fallbackTimezones
}

const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

type CreateRadioDialogProps = {
	trigger: React.ReactNode
}

export function CreateRadioDialog({ trigger }: CreateRadioDialogProps) {
	const createRadio = useAtomSet(createRadioAtom, { mode: "promiseExit" })
	const availableTimezones = getAvailableTimezones()

	const [isOpen, setIsOpen] = useState(false)
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [timezone, setTimezone] = useState(defaultTimezone)
	const [isPublic, setIsPublic] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const nameId = useId()
	const timezoneId = useId()
	const descriptionId = useId()

	const resetForm = () => {
		setName("")
		setDescription("")
		setTimezone(defaultTimezone())
		setIsPublic(false)
		setErrorMessage(null)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		setIsOpen(nextOpen)

		if (!nextOpen && !isSubmitting) {
			resetForm()
		}
	}

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		const trimmedName = name.trim()
		const trimmedTimezone = timezone.trim()
		const trimmedDescription = description.trim()

		if (!trimmedName || !trimmedTimezone) {
			setErrorMessage("Nome e timezone são obrigatórios.")
			return
		}

		setIsSubmitting(true)
		setErrorMessage(null)

		const exit = await createRadio({
			payload: {
				name: trimmedName,
				description: trimmedDescription.length > 0 ? trimmedDescription : null,
				timezone: trimmedTimezone,
				isPublic,
			},
			reactivityKeys: [radioListReactivityKey],
		})

		setIsSubmitting(false)

		if (Exit.isSuccess(exit)) {
			resetForm()
			setIsOpen(false)
			return
		}

		setErrorMessage("Nao foi possivel criar a radio. Tenta novamente.")
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>

			<DialogContent>
				<DialogHeader>
					<DialogTitle>Criar radio</DialogTitle>
					<DialogDescription>
						Define o nome e a configuracao base da estacao. Podes ajustar o resto depois no console
						da radio.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor={nameId}>Nome</Label>
						<Input
							id={nameId}
							value={name}
							maxLength={120}
							placeholder="Tokyo Hits"
							autoComplete="off"
							disabled={isSubmitting}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={timezoneId}>Timezone</Label>
						<Select value={timezone} disabled={isSubmitting} onValueChange={setTimezone}>
							<SelectTrigger id={timezoneId}>
								<SelectValue placeholder="Escolhe uma timezone" />
							</SelectTrigger>

							<SelectContent>
								{availableTimezones.map((timezoneOption) => (
									<SelectItem key={timezoneOption} value={timezoneOption}>
										{timezoneOption}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor={descriptionId}>Descricao</Label>
						<Textarea
							id={descriptionId}
							value={description}
							maxLength={2000}
							placeholder="Uma breve nota editorial para identificar a estacao."
							disabled={isSubmitting}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</div>

					<div className="flex items-center justify-between gap-4 border-3 border-neo-black bg-surface-muted px-4 py-3 shadow-neo-badge">
						<div>
							<div className="text-sm font-extrabold uppercase tracking-[0.16em] text-neo-black">
								Radio publica
							</div>
							<p className={`mt-1 text-sm text-black/65 ${groteskFont.className}`}>
								Permite expor a estacao publicamente quando o stream estiver pronto.
							</p>
						</div>

						<Switch checked={isPublic} disabled={isSubmitting} onCheckedChange={setIsPublic} />
					</div>

					{errorMessage ? (
						<div
							className={`border-3 border-neo-black bg-[#ffb4a8] px-4 py-3 text-sm font-bold text-neo-black shadow-neo-badge ${groteskFont.className}`}
						>
							{errorMessage}
						</div>
					) : null}

					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							disabled={isSubmitting}
							onClick={() => handleOpenChange(false)}
						>
							Cancelar
						</Button>

						<Button type="submit" variant="default" disabled={isSubmitting}>
							{isSubmitting ? "A criar..." : "Criar radio"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
