"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg">
        PREDICTION<span className="text-bull"> · </span>DAILY
      </h1>
      <p className="mt-6 text-lg text-fg">加载出错了</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        今日早报暂时无法加载。这通常是临时问题，请稍后重试。
      </p>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <button
          onClick={reset}
          className="rounded-md border border-bull/40 bg-bull/10 px-4 py-2 text-bull transition-colors hover:bg-bull/20"
        >
          重试
        </button>
        <Link href="/archive" className="text-muted transition-colors hover:text-bull">
          查看往期 →
        </Link>
      </div>
    </div>
  );
}
