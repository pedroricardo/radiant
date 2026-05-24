import { useTranslations } from "next-intl"

import { StatCard } from "../ui/StatCard"

export function FeatureStatsRow(props: { className?: string }) {
	const t = useTranslations("home.stats")

	return (
		<div className={`flex flex-wrap items-start gap-4 ${props.className ?? ""}`}>
			<StatCard label={t("playoutLabel")} accentClassName="bg-neo-paper">
				{t("playoutValue")}
			</StatCard>
			<StatCard label={t("licenceLabel")} accentClassName="bg-neo-mint">
				GPL-3.0
			</StatCard>
			<StatCard label={t("outputLabel")} accentClassName="bg-neo-orange">
				{t("outputValue")}
			</StatCard>
		</div>
	)
}
