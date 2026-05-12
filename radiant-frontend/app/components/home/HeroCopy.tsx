import { Button } from "../ui/Button"
import { displayFont, groteskFont } from "../../lib/fonts"

export function HeroCopy() {
	return (
		<div>
			<h2 className={`${displayFont.className} max-w-[8ch] text-[4.2rem] leading-[0.88] text-neo-black sm:text-[5.6rem] lg:text-[7.4rem]`}>
				OWN THE AIR
			</h2>

			<p className={`${groteskFont.className} mt-6 max-w-[34rem] text-lg leading-8 text-black/75 sm:text-xl`}>
				Stop waiting for the right station to appear.
				<br />
				Start your own.
			</p>

			<div className="mt-8 flex flex-wrap gap-4">
				<Button asChild>
					<a href="/login" draggable={false}>
						Get Started
					</a>
				</Button>
			</div>
		</div>
	)
}
