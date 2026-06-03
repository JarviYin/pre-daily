import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { graph, faqNode, breadcrumbNode, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "关于与方法论",
  description:
    "Prediction Daily 是什么、数据从哪来、今日异动与热度如何计算、更新时间与免责声明。基于 Polymarket 公开数据的预测市场中文信号早报。",
  alternates: { canonical: "/about" },
  openGraph: { title: "关于与方法论 · Prediction Daily", type: "article", url: "/about" },
};

// Genuine, citable Q&A — the format generative engines extract most readily.
const FAQ: { q: string; a: string }[] = [
  {
    q: "什么是预测市场？",
    a: "预测市场是参与者用真金白银对未来事件结果下注的市场。某个结果的交易价格直接反映市场对它发生概率的集体判断——例如某结果价格为 0.62 美元，约等于市场认为它有 62% 的概率发生。",
  },
  {
    q: "Prediction Daily 的数据来自哪里？",
    a: "全部来自 Polymarket 的公开 Gamma API（实时、无需鉴权）。概率取自各结果的市场价格，24 小时变动、成交量、流动性均为 Polymarket 公开数据。本站与 Polymarket 无隶属关系。",
  },
  {
    q: "“今日异动”和“热度”是怎么计算的？",
    a: "每个市场的复合热度分 = 24 小时概率变动幅度 + 资金放量倍数（24 小时成交量 ÷ 自身近 7 日日均）+ 新晋上线加成 + 临近揭晓且结果仍胶着的加成，并以流动性作为可信度门槛。头条为当日概率变动最大的市场。",
  },
  {
    q: "为什么不按成交量排名？",
    a: "按累计成交量排名，每天上榜的都是同一批常青大盘（如年度大选、比特币全年价格），看不出“今天发生了什么”。Prediction Daily 按“变化”而非“存量”排序，并剔除体育赛事、电竞、每日加密价格梯子等机械波动市场，只保留世界事件。",
  },
  {
    q: "中文解读是人写的还是 AI 生成的？",
    a: "由 DeepSeek 大模型基于上述真实数据生成，仅就概率与资金变化本身作判断，不引入数据未提供的外部新闻，不构成任何投资建议。",
  },
  {
    q: "多久更新一次？",
    a: "每天北京时间（UTC+8）08:00 自动发布一刊，可通过网站、RSS（/feed.xml）或 Telegram 频道 @predaily 获取。",
  },
  {
    q: "这构成投资建议吗？",
    a: "不构成。本站为预测市场信息聚合与中文解读，所有内容仅供参考，不构成任何投资建议。",
  },
];

const aboutPageNode = {
  "@type": "AboutPage",
  "@id": `${SITE}/about`,
  url: `${SITE}/about`,
  name: "关于与方法论 · Prediction Daily",
  inLanguage: "zh-CN",
  isPartOf: { "@id": `${SITE}/#website` },
  publisher: { "@id": `${SITE}/#organization` },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
        <span className="inline-block h-3.5 w-0.5 bg-bull" />
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <JsonLd data={graph(faqNode(FAQ), breadcrumbNode(null), aboutPageNode)} />

      <nav className="text-[13px]">
        <Link href="/" className="text-muted transition-colors hover:text-bull">
          ← 返回最新一刊
        </Link>
      </nav>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
        关于 Prediction Daily
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Prediction Daily（预测市场中文早报）每天北京时间 08:00
        发布一刊，从 Polymarket 上挑出“今天真正发生变化”的世界事件市场——概率显著变动、资金放量、新晋上线或临近揭晓——并附 AI
        中文解读。用 3 分钟看懂真金白银今日在重新定价什么。
      </p>

      <Section title="数据来源">
        <p>
          所有概率、24 小时变动、成交量与流动性均来自{" "}
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bull underline-offset-2 hover:underline"
          >
            Polymarket
          </a>{" "}
          的公开 Gamma API（实时、无需鉴权）。某结果的概率即其市场价格。本站与 Polymarket 无隶属关系。
        </p>
      </Section>

      <Section title="选题与排序方法">
        <p>
          我们不按累计成交量排名（那样每天都是同一批常青大盘），而是按“变化”排序。每个市场的复合热度分综合了：
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>24 小时概率变动幅度（异动）</li>
          <li>资金放量倍数：24 小时成交量 ÷ 自身近 7 日日均（放量）</li>
          <li>新晋上线加成（新晋）</li>
          <li>临近揭晓且结果仍胶着的加成（临近揭晓）</li>
        </ul>
        <p>
          并以流动性作为可信度门槛。体育赛事、电竞、每日加密价格梯子、推文计数等“机械波动”市场会被剔除，只保留政治、地缘、宏观经济、加密叙事、科技与
          AI、文化等世界事件。每刊以“今日最大异动”为头条，下接按热度排序的市场榜，再附 1–2 个常青市场作背景参照。
        </p>
      </Section>

      <Section title="中文解读">
        <p>
          逐市场解读与今日信号摘要由 DeepSeek 大模型基于上述真实数据生成，仅就概率与资金变化本身作判断，不引入数据未提供的外部新闻或来源。
        </p>
      </Section>

      <Section title="常见问题">
        <dl className="space-y-4">
          {FAQ.map((x) => (
            <div key={x.q}>
              <dt className="text-[14px] font-medium text-fg">{x.q}</dt>
              <dd className="mt-1 text-[14px] leading-relaxed text-muted">{x.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="免责声明">
        <p>
          本站为预测市场信息聚合与中文解读，所有内容仅供参考，不构成任何投资建议。
        </p>
      </Section>

      <footer className="mt-12 border-t border-line pt-6 text-[13px] text-faint">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/" className="text-muted transition-colors hover:text-bull">
            最新一刊
          </Link>
          <Link href="/archive" className="text-muted transition-colors hover:text-bull">
            往期归档
          </Link>
          <a
            href="https://t.me/predaily"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-bull"
          >
            Telegram 订阅
          </a>
          <a
            href="/feed.xml"
            className="text-muted transition-colors hover:text-bull"
          >
            RSS
          </a>
        </div>
      </footer>
    </div>
  );
}
