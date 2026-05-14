import { groteskFont, tomorrowFont } from "../../lib/fonts"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "../ui/ContextMenu"
import { Panel } from "./Panel"

const nodes = [
	"Music/Festival Cuts/Fujii Kaze - Matsuri.m4a",
	"Music/Drive Time/Station ID 04.wav",
	"Jingles/Top Of Hour 01.mp3",
	"Ads/Sponsor Intro 02.mp3",
]

export function LibrarySnapshotPanel() {
	return (
		<Panel title="Media Library" kicker="VFS snapshot" className="lg:col-span-4">
			<div className="space-y-2">
				{nodes.map((node) => (
					<ContextMenu key={node}>
						<ContextMenuTrigger asChild>
							<div className="border-3 border-neo-black bg-surface-muted px-3 py-3 shadow-neo-badge">
								<p
									className={`${tomorrowFont.className} text-[10px] font-extrabold uppercase text-black/55`}
								>
									File node
								</p>
								<p
									className={`${groteskFont.className} mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold tracking-tight text-neo-black`}
								>
									{node}
								</p>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem>Preview</ContextMenuItem>
							<ContextMenuItem>Queue Next</ContextMenuItem>
							<ContextMenuItem>Interrupt Transmission</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				))}
			</div>
		</Panel>
	)
}
