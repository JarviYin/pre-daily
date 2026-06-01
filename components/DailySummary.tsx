export function DailySummary({ summary }: { summary: string }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
        <span className="inline-block h-3 w-0.5 bg-bull" />
        今日值得注意的信号
      </h2>
      <blockquote className="mt-3 rounded-lg border border-line bg-surface p-4 text-[15px] leading-relaxed text-fg sm:p-5">
        {summary}
      </blockquote>
    </section>
  );
}
