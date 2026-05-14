import { cva, type VariantProps } from "class-variance-authority"

import { tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const statusPillVariants = cva(
	`inline-flex items-center border-3 border-neo-black px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-neo-badge ${tomorrowFont.className}`,
	{
		variants: {
			variant: {
				live: "bg-signal-live text-white",
				success: "bg-signal text-neo-black",
				info: "bg-surface-accent text-neo-black",
				muted: "bg-surface-muted text-neo-black",
				danger: "bg-signal-live text-white",
			},
		},
		defaultVariants: {
			variant: "muted",
		},
	},
)

export function StatusPill({
	className,
	variant,
	children,
}: React.PropsWithChildren<{ className?: string } & VariantProps<typeof statusPillVariants>>) {
	return <span className={cn(statusPillVariants({ variant }), className)}>{children}</span>
}
