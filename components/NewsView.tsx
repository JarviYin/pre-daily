import { CategoryChip } from "@/components/CategoryChip";
import { formatCnDate } from "@/lib/date";
import { formatMove, formatPct, formatVolume } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

// 新闻版正文（头条 + 要闻 + 方法论），被 /news、/news/[date]、/preview/news
// 三处复用。数据自包含（生成时已把市场快照注入每个 item）。

/** 市场数字条：领先选项 + 概率 + 24h变动 + 量 + 流动性 + 截止。 */
function MarketStrip({ item }: { item: NewsItem }) {
  const move = formatMove(item.move24h);
  const moveColor =
    move.dir === "up" ? "text-bull" : move.dir === "down" ? "text-bear" : "text-faint";
  return (
    <div className="tnum mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-faint">
      <span className="max-w-[45%] truncate text-muted">{item.leadOption}</span>
      <span className="text-base font-semibold text-bull">{formatPct(item.leadProb)}</span>
      <span className={moveColor}>{move.text}</span>
      <span>24h {formatVolume(item.volume24hr)}</span>
      <span>流动性 {formatVolume(item.liquidity)}</span>
      {item.endDate && <span>截止 {item.endDate.slice(0, 10)}</span>}
    </div>
  );
}

function NewsBody({ item }: { item: NewsItem }) {
  return (
    <>
      <p className="mt-3 text-[14px] leading-relaxed text-fg">{item.story}</p>
      <MarketStrip item={item} />
      <p className="mt-3 text-[13px] leading-relaxed">
        <span className="font-medium text-bull">为什么重要 </span>
        <span className="text-muted">{item.significance}</span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
        可信度 · {item.confidence}
      </p>
    </>
  );
}

export function NewsView({
  date,
  items,
  generatedAt,
  badge,
  footnote,
}: {
  date: string;
  items: NewsItem[];
  generatedAt?: string;
  badge?: string; // e.g. "新闻版 · 原型预览"
  footnote?: string; // extra prototype note (prototype page only)
}) {
  const [lead, ...rest] = items;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      {/* Header — 新闻版 masthead */}
      <header className="pt-10 sm:pt-14">
        <div className="flex items-center justify-center gap-2">
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg sm:text-2xl">
            PREDICTION<span className="text-bull"> · </span>DAILY
          </h1>
          {badge && (
            <span className="rounded border border-warn/50 px-1.5 py-0.5 text-[11px] font-medium text-warn">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-3 text-center text-[15px] text-muted">
          {formatCnDate(date)} · 全球大事要闻
        </p>
        <p className="mt-1.5 text-center text-[13px] text-faint">
          基于 Polymarket 真实市场数据，用真金白银的定价改写今日世界要闻
        </p>
        <div className="masthead-rule mt-6 h-px w-full" />
      </header>

      {/* 今日头条 */}
      {lead && (
        <article className="mt-8 overflow-hidden rounded-2xl border border-bull/30 bg-gradient-to-b from-bull-dim to-surface">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-bull">
                <span aria-hidden>📰</span> 今日头条
              </span>
              <CategoryChip category={lead.category} />
            </div>
            <h2 className="mt-3 text-[20px] font-semibold leading-snug text-fg sm:text-[24px]">
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-bull"
              >
                {lead.title}
              </a>
            </h2>
            <NewsBody item={lead} />
          </div>
        </article>
      )}

      {/* 今日要闻 */}
      {rest.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
            <span className="inline-block h-3 w-0.5 bg-bull" />
            今日要闻
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {rest.map((item, i) => (
              <article
                key={item.slug}
                className="rounded-xl border border-line bg-surface p-4 sm:p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="tnum w-5 text-right text-sm text-faint">{i + 2}</span>
                  <CategoryChip category={item.category} />
                </div>
                <h3 className="mt-2 text-[17px] font-semibold leading-snug text-fg">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-bull"
                  >
                    {item.title}
                  </a>
                </h3>
                <NewsBody item={item} />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 方法论 + 免责（+ 原型说明） */}
      <section className="mt-10 rounded-lg border border-line bg-surface p-4 text-[12px] leading-relaxed text-faint sm:p-5">
        <p className="font-medium text-muted">新闻版 · 产品说明</p>
        <p className="mt-1.5">
          ① 数据源：Polymarket 公开市场数据（概率、24h变动、成交量、流动性）。②
          改写：LLM 把「市场在定价什么」改写成新闻叙述，标题必须含具体数字，绝不编造数据外的事件。
          ③ 选刊：新闻价值 = 事件的世界影响 × 市场确信度（量/流动性）× 今日新鲜度（异动/放量/临近揭晓），
          与信号版（按热度/异动选刊、面向交易者）共用同一条数据管线，只是编辑角度不同。
        </p>
        {footnote && <p className="mt-2">{footnote}</p>}
        {generatedAt && (
          <p className="tnum mt-2">内容生成于 {generatedAt} · 每日 8:00 随主刊自动更新</p>
        )}
        <p className="mt-2">以上为公开数据的信息解读，不构成投资建议。</p>
      </section>
    </div>
  );
}
