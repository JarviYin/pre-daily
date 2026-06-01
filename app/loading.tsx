// Skeleton that mirrors the edition layout — not a bare spinner.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="pt-10 sm:pt-14">
        <div className="mx-auto h-8 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mx-auto mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface" />
        <div className="masthead-rule mt-6 h-px w-full" />
      </div>
      <div className="mt-8 h-24 animate-pulse rounded-lg bg-surface" />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="mt-4 h-2.5 w-full animate-pulse rounded-full bg-surface-2" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
