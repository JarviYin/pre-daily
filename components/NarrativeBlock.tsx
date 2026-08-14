import type { DailyNarrative, DailyPillar } from "@/lib/types";

// 论点线：把一刊从"10 张独立卡片"变成"一个论点 + 论据 + 反方 + 明日观察"。
// 出现在刊首，取代旧的 summary 卡（narrative 存在时）。

function Pillar({ pillar, n }: { pillar: DailyPillar; n: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bull/15 text-[13px] font-semibold text-bull">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-fg">
            {pillar.claim}
          </p>
          {pillar.evidence && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              {pillar.evidence}
            </p>
          )}
          {pillar.soWhat && (
            <p className="mt-2 border-l-2 border-bull/40 pl-2.5 text-[13px] leading-relaxed text-fg/80">
              <span className="font-medium text-bull">所以 </span>
              {pillar.soWhat}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function NarrativeBlock({ narrative }: { narrative: DailyNarrative }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
        <span className="inline-block h-3 w-0.5 bg-bull" />
        今日论点
      </h2>
      <p className="mt-2 text-[19px] font-bold leading-snug text-fg sm:text-[22px]">
        {narrative.thesis}
      </p>

      {narrative.pillars.length > 0 && (
        <div className="mt-4 space-y-3">
          {narrative.pillars.map((p, i) => (
            <Pillar key={i} pillar={p} n={i + 1} />
          ))}
        </div>
      )}

      {(narrative.counterView || narrative.watch) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {narrative.counterView && (
            <div className="rounded-lg border border-bear/30 bg-surface p-4">
              <p className="text-[13px] font-medium text-bear">⚖️ 反方与分歧</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {narrative.counterView}
              </p>
            </div>
          )}
          {narrative.watch && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[13px] font-medium text-bull">🔭 明日观察</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {narrative.watch}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
