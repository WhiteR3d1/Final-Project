/** ไอคอน inline SVG ทั้งชุดของแอป — ใช้ currentColor เสมอเพื่อให้รับสีจาก token ที่ครอบอยู่ */

type IconProps = {
  size?: number;
  className?: string;
};

function svgProps({ size = 16, className }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

export function IconBoard(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3" y="4" width="6" height="16" rx="1.5" />
      <rect x="11" y="4" width="6" height="10" rx="1.5" />
      <path d="M19 4h2v16h-2" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconDots(props: IconProps) {
  return (
    <svg {...svgProps(props)} strokeWidth={2}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...svgProps(props)} strokeWidth={2.25}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M5 21V4" />
      <path d="M5 5h10.5l-1.5 3.5L15.5 12H5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconChecklist(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m3 7 2 2 3-3.5M3 16l2 2 3-3.5" />
      <path d="M12 7h9M12 17h9" />
    </svg>
  );
}

export function IconComment(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17 14.5a6.5 6.5 0 0 1 4.5 5.5" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8 6 12l4 4M6 12h10" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  );
}

export function IconFire(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-1.5.6-2.8 1.5-3.8C9 10 10 11 10.5 12c.5-3 1.5-7 1.5-9z" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M10 14h4l.5 4h-5z" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function IconGrip(props: IconProps) {
  const { size = 16, className } = props;
  return (
    <svg
      width={size * 0.65}
      height={size}
      viewBox="0 0 10 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="2.5" cy="2.5" r="1.5" />
      <circle cx="7.5" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="7.5" cy="8" r="1.5" />
      <circle cx="2.5" cy="13.5" r="1.5" />
      <circle cx="7.5" cy="13.5" r="1.5" />
    </svg>
  );
}
