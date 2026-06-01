export function EmptyState({
  title = "首刊即将发布",
  message = "数据管道已就绪，第一期《预测市场中文早报》将在下一次定时刷新（每天 8:00）后上线。",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-fg">
        PREDICTION<span className="text-bull"> · </span>DAILY
      </h1>
      <p className="mt-6 text-lg text-fg">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{message}</p>
    </div>
  );
}
