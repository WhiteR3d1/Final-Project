import type { ReactNode } from "react";

/** กล่องพื้นฐานของทุกหน้าจอ — พื้น panel + ขอบ line ตาม token ธีม */
export function Panel({
  title,
  subtitle,
  action,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`border-line bg-panel overflow-hidden rounded-2xl border ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h2 className="text-text text-base font-semibold">{title}</h2>}
            {subtitle && <p className="text-muted mt-0.5 text-xs">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`px-5 pt-4 pb-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
