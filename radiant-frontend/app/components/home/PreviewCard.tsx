import { CoverArt } from "../ui/CoverArt"
import { Card, CardContent, CardFooter, CardHeader } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { PreviewVolumeControl } from "../PreviewVolumeControl"
import { StaticImageData } from "next/image"
import { cn } from "../../lib/utils"

function MetaBox(props: { label: string; value: string; className?: string; valueClassName?: string }) {
	return (
		<Card className={cn("bg-white px-3 py-2 text-neo-black", props.className)}>
			<p className={`${groteskFont.className} text-[10px] font-extrabold uppercase tracking-[0.18em] text-black/55`}>
				{props.label}
			</p>
			<p className={cn(`${tomorrowFont.className} mt-1 text-sm font-extrabold uppercase`, props.valueClassName)}>
				{props.value}
			</p>
		</Card>
	)
}

export function PreviewCard(props: { cover: StaticImageData }) {
	return (
		<Card className="bg-white p-5 text-neo-black shadow-neo-panel sm:p-6">
			<CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
				<div>
					<p className={`text-[10px] font-extrabold uppercase tracking-[0.26em] text-black/55 ${groteskFont.className}`}>
						Preview
					</p>
					<h3 className={`${tomorrowFont.className} mt-3 text-3xl font-extrabold uppercase text-neo-red sm:text-4xl`}>
						On air now
					</h3>
				</div>
				<Badge variant="live" className="text-[10px] tracking-[0.18em]">
					On air
				</Badge>
			</CardHeader>

			<CardContent className="my-6 grid max-h-100 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-5">
				<CoverArt src={props.cover} alt="Matsuri cover art" className="h-full aspect-square" />

				<div className="flex h-full flex-col justify-between">
					<Card className="bg-neo-paper px-4 py-3 text-neo-black">
						<p className={`text-[10px] font-extrabold uppercase tracking-[0.2em] text-black/55 ${groteskFont.className}`}>
							Playlist
						</p>
						<p className={`${groteskFont.className} mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold tracking-tight`}>
							Sunset Rotation / Festival Cuts
						</p>
					</Card>

					<div className="mt-3">
						<h4 className={`${tomorrowFont.className} text-[2.15rem] leading-[0.92] font-extrabold text-neo-black`}>
							Matsuri
						</h4>
						<p className={`${groteskFont.className} mt-2 text-base font-bold tracking-tight text-neo-black`}>
							Fujii Kaze
						</p>
						<div className="mt-4 flex flex-wrap gap-3">
							<MetaBox label="Ends at" value="18:24" />
							<MetaBox
								label="Status"
								value="Live"
								className="bg-neo-red text-white"
								valueClassName="text-white"
							/>
						</div>
					</div>
				</div>

				<PreviewVolumeControl />
			</CardContent>

			<CardFooter className="mx-[-1.25rem] mt-6 border-t-3 border-neo-black px-5 pt-4 text-neo-black sm:mx-[-1.5rem] sm:px-6">
				<p className={`${groteskFont.className} text-xs font-extrabold uppercase tracking-[0.18em]`}>
					NEXT: Lamp - 恋人へ / Koibito e
				</p>
			</CardFooter>
		</Card>
	)
}
