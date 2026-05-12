import { groteskFont } from "../../lib/fonts"
import { RadiantLogo } from "../RadiantLogo"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"

export function TopBar(props: { username: string; avatarUrl?: string }) {
	return (
		<div className="flex items-center justify-between border-b-3 border-neo-black bg-white px-6 py-4">
			<div className="flex items-center gap-6">
				<RadiantLogo />
				<Badge variant="mint">BETA</Badge>
			</div>

			<div className="flex items-center gap-4">
				<Button variant="secondary" size="sm">Go Live</Button>
				<div className={`flex items-center gap-3 text-sm font-bold tracking-tight text-neo-black ${groteskFont.className}`}>
					{props.avatarUrl ? <img src={props.avatarUrl} className="h-8 w-8 border-3 border-neo-black shadow-neo-badge" /> : null}
					{props.username}
				</div>
			</div>
		</div>
	)
}
