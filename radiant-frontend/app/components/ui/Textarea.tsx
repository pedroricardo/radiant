import * as React from "react"

import { groteskFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					`flex min-h-[108px] w-full border-3 border-neo-black bg-white px-3 py-2 text-sm text-neo-black shadow-neo-badge outline-none placeholder:text-black/45 disabled:cursor-not-allowed disabled:opacity-50 ${groteskFont.className}`,
					className
				)}
				ref={ref}
				{...props}
			/>
		)
	}
)
Textarea.displayName = "Textarea"

export { Textarea }
