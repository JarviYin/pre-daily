import type { Category } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

const COLORS: Record<Category, string> = {
  macro: "#f5b13d",
  crypto: "#19e09a",
  sports: "#4f9dff",
  geopolitics: "#ff5d6c",
  politics: "#b98bff",
  tech: "#46d6e0",
  other: "#9aa1ad",
};

export function CategoryChip({ category }: { category: Category }) {
  const color = COLORS[category];
  const { label, en } = CATEGORY_META[category];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide"
      style={{
        color,
        backgroundColor: `${color}1f`,
        border: `1px solid ${color}40`,
      }}
      title={en}
    >
      {label}
    </span>
  );
}
