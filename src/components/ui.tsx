import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path
          d="M7 18c0-5 3-9 7-11 4 2 7 6 7 11 0 4-3 7-7 7s-7-3-7-7z"
          fill="none"
          stroke="#c9a36a"
          strokeWidth="1.4"
        />
        <path d="M10 12c2 2 6 2 8 0" fill="none" stroke="#e8b4b8" strokeWidth="1.2" />
        <path d="M9 8c-3-1-5 2-3 4M19 8c3-1 5 2 3 4" fill="none" stroke="#c9a36a" strokeWidth="1.3" />
      </svg>
      <span className="serif text-lg tracking-wide">Clawmasutra</span>
    </Link>
  );
}

export function Button({
  children,
  href,
  type = "button",
  tone = "gold",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  tone?: "gold" | "ghost" | "blood";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    tone === "gold"
      ? "bg-[#c9a36a] text-[#14090c] hover:bg-[#d8b57d]"
      : tone === "blood"
        ? "bg-[#7a1f2e] text-[#f4e6d0] hover:bg-[#922536]"
        : "border border-[rgba(244,230,208,0.2)] hover:bg-white/5";
  const shared = `inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm tracking-wide transition disabled:opacity-40 ${cls}`;
  if (href) return <Link className={shared} href={href}>{children}</Link>;
  return (
    <button className={shared} type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  min,
  max,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  children?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mark">{label}</span>
      {children ?? (
        <input
          className="mt-2 w-full rounded-xl border border-[rgba(244,230,208,0.16)] bg-[#1f1014] px-3 py-2.5 outline-none focus:border-[#c9a36a]"
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          min={min}
          max={max}
        />
      )}
    </label>
  );
}
