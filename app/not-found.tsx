import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg">
        PREDICTION<span className="text-bull"> · </span>DAILY
      </h1>
      <p className="mt-6 text-lg text-fg">没有找到这一刊</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        这一天还没有发布早报，或链接有误。
      </p>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link href="/" className="text-bull transition-colors hover:underline">
          返回今日
        </Link>
        <Link href="/archive" className="text-muted transition-colors hover:text-bull">
          往期归档 →
        </Link>
      </div>
    </div>
  );
}
