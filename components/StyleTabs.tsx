"use client";

interface StyleCount {
  slug: string;
  nameZh: string;
  count: number;
}

interface StyleTabsProps {
  styles: StyleCount[];
  activeStyle: string | null;
  onStyleChange: (slug: string) => void;
}

export default function StyleTabs({
  styles,
  activeStyle,
  onStyleChange,
}: StyleTabsProps) {
  // All 5 styles, showing count if available
  const allStyles = [
    { slug: "zhuan", nameZh: "篆" },
    { slug: "li", nameZh: "隸" },
    { slug: "kai", nameZh: "楷" },
    { slug: "xing", nameZh: "行" },
    { slug: "cao", nameZh: "草" },
  ];

  return (
    <div className="flex border-b border-[var(--border)]">
      {allStyles.map((style) => {
        const countInfo = styles.find((s) => s.slug === style.slug);
        const count = countInfo?.count || 0;
        const isActive = activeStyle === style.slug;

        return (
          <button
            key={style.slug}
            onClick={() => onStyleChange(style.slug)}
            className={`flex-1 py-3 px-2 text-center relative transition-colors ${
              isActive
                ? "text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="text-base">{style.nameZh}</span>
            {count > 0 && (
              <sup className="ml-0.5 text-xs">
                {count > 20 ? "20+" : count}
              </sup>
            )}
            {isActive && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--foreground)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
