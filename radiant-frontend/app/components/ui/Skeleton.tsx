import { cn } from "../../lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("animate-pulse border-3 border-neo-black bg-surface-muted shadow-neo-badge", className)} {...props} />
}

export { Skeleton }
