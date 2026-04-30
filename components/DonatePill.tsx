"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const BANK_INFO = "郵局（700） 于樂洋 00310190695347";

export default function DonatePill() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(BANK_INFO);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartXRef.current = event.clientX;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStartXRef.current === null) return;
    if (event.clientX - dragStartXRef.current > 18) {
      setOpen(true);
      dragStartXRef.current = null;
    }
  };

  const clearDrag = () => {
    dragStartXRef.current = null;
  };

  return (
    <div className="donate-pill-shell" ref={panelRef}>
      <button
        type="button"
        className={`donate-pill-trigger${open ? " donate-pill-trigger-open" : ""}`}
        aria-expanded={open}
        aria-controls="donate-panel"
        onClick={() => setOpen((value) => !value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDrag}
        onPointerCancel={clearDrag}
        onPointerLeave={clearDrag}
      >
        <span className="donate-pill-heart" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 20.5s-7-4.35-7-10.1C5 7.5 6.94 6 9.1 6c1.42 0 2.32.72 2.9 1.5C12.58 6.72 13.48 6 14.9 6 17.06 6 19 7.5 19 10.4c0 5.75-7 10.1-7 10.1Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="donate-pill-text">
          <span>贊助我</span>
          <span className="donate-pill-slash">/</span>
          <span>Donate</span>
        </span>
      </button>

      {open && (
        <div id="donate-panel" className="donate-pill-panel" role="dialog" aria-label="Donation options">
          <div className="donate-pill-section">
            <p className="donate-pill-label">Taiwan</p>
            <p className="donate-pill-title">Direct bank transfer</p>
            <p className="donate-pill-copy">{BANK_INFO}</p>
            <p className="donate-pill-note">匯款時請在備注註明這是贊助。</p>
            <button type="button" className="donate-pill-action" onClick={handleCopy}>
              {copied ? "已複製" : "複製匯款資訊"}
            </button>
          </div>

          <div className="donate-pill-divider" />

          <div className="donate-pill-section">
            <p className="donate-pill-label">Overseas</p>
            <p className="donate-pill-title">PayPal</p>
            <form action="https://www.paypal.com/donate" method="post" target="_top">
              <input type="hidden" name="business" value="6WETJRMEYYC22" />
              <input type="hidden" name="no_recurring" value="0" />
              <input
                type="hidden"
                name="item_name"
                value="Empower us to keep Chinese calligraphy accessible to everyone, free of charge."
              />
              <input type="hidden" name="currency_code" value="USD" />
              <button type="submit" className="donate-pill-action">
                Open PayPal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
