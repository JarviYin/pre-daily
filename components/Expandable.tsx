"use client";

import { useState } from "react";

/**
 * Client-side expand/collapse wrapper: shows `preview` plus a toggle button
 * that reveals `expanded`. Used to fold long lists (热度榜) behind one tap so
 * the top of the edition stays a tight argument line instead of a wall of cards.
 */
export function Expandable({
  preview,
  expanded,
  label,
}: {
  preview: React.ReactNode;
  expanded: React.ReactNode;
  label: string; // e.g. "展开其余 7 个市场"
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {preview}
      {open && expanded}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-4 w-full rounded-lg border border-line bg-surface py-2.5 text-[13px] font-medium text-muted transition-colors hover:border-bull/40 hover:text-bull"
      >
        {open ? "收起 ▲" : `展开 ${label} ▼`}
      </button>
    </div>
  );
}
