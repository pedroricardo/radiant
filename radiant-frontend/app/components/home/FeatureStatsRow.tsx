import { StatCard } from "../ui/StatCard"

export function FeatureStatsRow(props: { className?: string }) {
	return (
		<div className={`flex flex-wrap items-start gap-4 ${props.className ?? ""}`}>
			<StatCard label="Playout" accentClassName="bg-neo-paper">
				Calendar Driven
			</StatCard>
			<StatCard label="Licence" accentClassName="bg-neo-mint">
				GPL-3.0
			</StatCard>
			<StatCard label="Output" accentClassName="bg-neo-orange">
				ICY Ready
			</StatCard>
		</div>
	)
}
