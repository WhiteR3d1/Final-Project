"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** ปุ่ม submit ที่รู้สถานะกำลังส่งของฟอร์มที่มันอยู่ (กันกดซ้ำ + บอกผู้ใช้ว่ากำลังทำงาน) */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  title,
  ariaLabel,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={ariaLabel}
      className={`disabled:opacity-50 ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * ปุ่มลบแบบสองจังหวะ — กดครั้งแรกเปลี่ยนเป็น "ยืนยัน" กดซ้ำถึงจะ submit จริง
 * ใช้แทน window.confirm เพราะ dialog ของเบราว์เซอร์บล็อกทั้งหน้า
 */
export function ConfirmSubmitButton({
  children,
  confirmLabel = "ยืนยันลบ?",
  className = "",
  confirmClassName = "",
  title,
  ariaLabel,
}: {
  children: ReactNode;
  confirmLabel?: ReactNode;
  className?: string;
  confirmClassName?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        title={title}
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      autoFocus
      className={`disabled:opacity-50 ${confirmClassName || className}`}
    >
      {confirmLabel}
    </button>
  );
}
