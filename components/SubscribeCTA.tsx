// Telegram subscribe entry point — closes the web → subscribe → retention loop.
// Link target is env-configurable so it can point at a public channel later
// without a code change (set NEXT_PUBLIC_TELEGRAM_URL).
const TG_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/predailybot";

function TgGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.95.46l.34-4.8 8.73-7.9c.38-.34-.08-.53-.59-.19L6.7 13.2l-4.65-1.46c-1.01-.32-1.03-1.01.21-1.5L20.64 3.1c.84-.31 1.58.2 1.3 1.5Z" />
    </svg>
  );
}

/** Prominent pill button (used in the masthead). */
export function SubscribeButton() {
  return (
    <div className="mt-4 flex justify-center">
      <a
        href={TG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-bull/40 bg-bull/10 px-4 py-1.5 text-[13px] font-medium text-bull transition-colors hover:bg-bull/20"
      >
        <TgGlyph className="size-4" />
        订阅 Telegram 每日推送
      </a>
    </div>
  );
}

/** Quiet inline link (used in the footer). */
export function SubscribeLink() {
  return (
    <a
      href={TG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-muted transition-colors hover:text-bull"
    >
      <TgGlyph className="size-3.5" />
      Telegram 订阅
    </a>
  );
}
