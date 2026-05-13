import { PropsWithChildren } from "react"

import { cn } from "../../lib/utils"

export function PanelGrid(props: PropsWithChildren<{ className?: string }>) {
	return <div className={cn("grid gap-4 lg:grid-cols-12", props.className)}>{props.children}</div>
}
