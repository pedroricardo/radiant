import Image, { StaticImageData } from "next/image"

import { cn } from "../../lib/utils"
import { Card, CardContent } from "./Card"

type CoverArtProps = {
	src: StaticImageData | string
	alt: string
	className?: string
}

export function CoverArt(props: CoverArtProps) {
	return (
		<Card className={cn(" bg-neo-paper h-fit", props.className)}>
			<CardContent className="relative aspect-square overflow-hidden">
				<Image
					src={props.src}
					alt={props.alt}
					fill
					className="object-contain"
					sizes="(max-width: 1024px) 100vw, 24rem"
				/>
			</CardContent>
		</Card>
	)
}
