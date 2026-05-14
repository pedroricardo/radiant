"use client"

import { Atom, Result, useAtomInitialValues, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Cause } from "effect"

import { radioListAtom } from "../../lib/atoms/radiantClient"
import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Skeleton } from "../ui/Skeleton"
import { CreateRadioDialog } from "./CreateRadioDialog"
import { RadioTile } from "./RadioTile"
import { Radio } from "@radiant/client"

type DashboardRadioPickerProps = {
	initialRadios: ReadonlyArray<typeof Radio.RadioInfo.Type>
}

export function DashboardRadioPicker({ initialRadios }: DashboardRadioPickerProps) {
	const r = Atom.withServerValue(radioListAtom, () => Result.success(initialRadios));
	const radios = useAtomValue(r)
	const refreshRadios = useAtomRefresh(radioListAtom)

	return (
		<div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-6 py-10">
			<div className="flex flex-col items-center gap-4 text-center">
				<Badge variant="orange">Dashboard</Badge>

				<h1
					className={`select-none text-center text-4xl tracking-tight text-neo-black sm:text-5xl ${tomorrowFont.className}`}
				>
					Selecione um Radio
				</h1>

				<p
					className={`max-w-xl select-none text-sm font-bold tracking-tight text-black/65 sm:text-base ${groteskFont.className}`}
				>
					Escolhe uma estacao para abrir o console, acompanhar a automacao e gerir a library.
				</p>
			</div>

			{Result.match(radios, {
				onInitial: () => (
					<div className="mt-12 flex w-full max-w-4xl flex-wrap items-start justify-center gap-8">
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton key={index} className="h-[12.25rem] w-[11rem]" />
						))}
					</div>
				),
				onFailure: (failure) => (
					<div className="mt-12 flex max-w-xl flex-col items-center gap-4 border-3 border-neo-black bg-[#ffb4a8] px-6 py-6 text-center shadow-neo-badge">
						<p className={`text-base font-bold text-neo-black ${groteskFont.className}`}>
							Nao foi possivel carregar as radios.
						</p>

						<p className={`text-sm text-black/70 ${groteskFont.className}`}>
							{Cause.pretty(failure.cause)}
						</p>

						<Button variant="secondary" onClick={refreshRadios}>
							Tentar novamente
						</Button>
					</div>
				),
				onSuccess: ({ value: radioList }) => (
					<>
						{radioList.length > 0 ? (
							<div className="mt-10">
								<CreateRadioDialog
									trigger={
										<Button variant="default">
											Criar radio
										</Button>
									}
								/>
							</div>
						) : null}

						<div className="mt-12 flex flex-wrap items-start justify-center gap-8">
							{radioList.map((radio) => (
								<RadioTile key={radio.id} id={radio.id} name={radio.name} />
							))}
						</div>

						{radioList.length === 0 ? (
							<div className="mt-12 flex flex-col items-center gap-4 border-3 border-neo-black bg-neo-paper px-6 py-6 shadow-neo-badge">
								<p className={`select-none text-center text-base text-black/70 ${groteskFont.className}`}>
									Ainda nao tens radios. Cria a primeira estacao para comecar.
								</p>

								<CreateRadioDialog
									trigger={
										<Button variant="default">
											Criar radio
										</Button>
									}
								/>
							</div>
						) : null}
					</>
				),
			})}
		</div>
	)
}
