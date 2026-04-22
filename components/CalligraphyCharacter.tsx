"use client";

import React, { useId, useState, useEffect, useRef } from "react";

interface CalligraphyCharacterProps {
  imageUrl: string;
  char: string;
  grid?: "none" | "jiu" | "mi";
  invert?: boolean;
  wireframe?: boolean;
  removeBg?: boolean;
  size?: number;
  showBorder?: boolean;
  borderShape?: "square" | "circle";
  borderWidth?: number;
  borderColor?: string;
}

export default function CalligraphyCharacter({
  imageUrl,
  char,
  grid = "none",
  invert = false,
  wireframe = false,
  removeBg = false,
  size = 128,
  showBorder = true,
  borderShape = "square",
  borderWidth = 1,
  borderColor = "var(--border)",
}: CalligraphyCharacterProps) {
  const filterId = useId().replace(/:/g, "");

  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [retryToken, setRetryToken] = useState(0);
  const attemptRef = useRef(0);

  useEffect(() => {
    setStatus("loading");
    setRetryToken(0);
    attemptRef.current = 0;
  }, [imageUrl]);

  // One retry with a cache-buster absorbs transient R2/network drops on mobile.
  const handleError = () => {
    if (attemptRef.current < 1) {
      attemptRef.current += 1;
      setTimeout(() => setRetryToken((t) => t + 1), 500);
    } else {
      setStatus("failed");
    }
  };

  let filterUrl = "";
  if (wireframe) {
    filterUrl = invert ? `url(#wire-white-${filterId})` : `url(#wire-black-${filterId})`;
  } else if (removeBg) {
    filterUrl = invert ? `url(#ink-white-${filterId})` : `url(#ink-black-${filterId})`;
  }

  const baseCssFilter = (!wireframe && !removeBg) 
    ? (invert ? "grayscale(1) invert(1) contrast(150%)" : "grayscale(1) contrast(200%) brightness(110%)")
    : "none";

  return (
    <div 
      className={`relative overflow-hidden select-none transition-all duration-300 ${
        removeBg || wireframe ? "bg-transparent" : "bg-[var(--card-bg)]"
      }`}
      style={{ 
        width: size, 
        height: size,
        // DYNAMIC BORDER LOGIC
        border: showBorder ? `${borderWidth}px solid ${borderColor}` : 'none',
        borderRadius: borderShape === "circle" ? "50%" : "12px",
      }}
    >
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          {/* ... (keep existing filter definitions) ... */}
          <filter id={`ink-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" /><feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feColorMatrix in="cleanImage" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" result="alpha" />
            <feComponentTransfer in="alpha"><feFuncA type="linear" slope="4" intercept="-2.8" /><feFuncR type="linear" slope="0" intercept="0" /><feFuncG type="linear" slope="0" intercept="0" /><feFuncB type="linear" slope="0" intercept="0" /></feComponentTransfer>
          </filter>
          <filter id={`ink-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" /><feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feColorMatrix in="cleanImage" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" result="alpha" /><feComponentTransfer in="alpha"><feFuncA type="linear" slope="4" intercept="-2.8" /><feFuncR type="linear" slope="0" intercept="1" /><feFuncG type="linear" slope="0" intercept="1" /><feFuncB type="linear" slope="0" intercept="1" /></feComponentTransfer>
          </filter>
          <filter id={`wire-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" /><feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feConvolveMatrix in="cleanImage" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" />
            <feColorMatrix in="edges" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0" /><feComponentTransfer><feFuncA type="linear" slope="2.5" intercept="-0.1" /><feFuncR type="linear" slope="0" intercept="0" /><feFuncG type="linear" slope="0" intercept="0" /><feFuncB type="linear" slope="0" intercept="0" /></feComponentTransfer>
          </filter>
          <filter id={`wire-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" /><feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feConvolveMatrix in="cleanImage" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" />
            <feColorMatrix in="edges" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 1 1 0 0" /><feComponentTransfer><feFuncA type="linear" slope="2.5" intercept="-0.1" /><feFuncR type="linear" slope="0" intercept="1" /><feFuncG type="linear" slope="0" intercept="1" /><feFuncB type="linear" slope="0" intercept="1" /></feComponentTransfer>
          </filter>
          <filter id={`bleed-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            {/* The core: slightly thicken the ink (dilate) */}
            <feMorphology operator="dilate" radius="0.5" in="cleanImage" result="thickened" />
            {/* The soft edge: subtle blur */}
            <feGaussianBlur stdDeviation="0.4" in="thickened" result="softened" />
            {/* Re-apply the color matrix to turn it back to black ink */}
          <feColorMatrix in="softened" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" />
        </filter>
        </defs>
      </svg>

{grid !== "none" && (
  <svg 
    className="absolute inset-0 w-full h-full pointer-events-none z-0" 
    viewBox="0 0 100 100"
    style={{ opacity: 0.6 }} // Increased from 0.3
  >
    {/* Main Border */}
    <rect width="100" height="100" fill="none" stroke="#8b0000" strokeWidth="0.8" />
    
    {grid === "jiu" ? (
      <>
        {/* 九宮格 */}
        <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="66.6" y1="0" x2="66.6" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="0" y1="66.6" x2="100" y2="66.6" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
      </>
    ) : (
      <>
        {/* 米字格 */}
        <line x1="50" y1="0" x2="50" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#8b0000" strokeWidth="0.4" strokeDasharray="2,2" />
      </>
    )}
  </svg>
)}

      {/* 2. Character Logic inside CalligraphyCharacter.tsx */}
<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
  <div className="relative w-[85%] h-[85%] flex items-center justify-center">

    {/* 🔥 STRICT CHECK: Only render img if imageUrl is a real string */}
    {typeof imageUrl === 'string' && imageUrl.length > 5 && status !== "failed" ? (
      <>
        {status === "loading" && (
          <div className="absolute inset-0 rounded-md bg-[var(--border)]/30 animate-pulse" aria-hidden="true" />
        )}
        <img
          src={`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}cors=1${retryToken > 0 ? `&r=${retryToken}` : ''}`}
          alt={char}
          className="max-w-full max-h-full object-contain transition-all duration-300"
          crossOrigin="anonymous"
          onLoad={() => setStatus("loaded")}
          onError={handleError}
          style={{
            filter: filterUrl ? filterUrl : baseCssFilter,
            opacity: status === "loaded" ? 1 : 0,
          }}
        />
      </>
    ) : (
      /* Fallback if URL is corrupted or image failed to load after retry */
      <span className="text-4xl opacity-20">{char}</span>
    )}

  </div>
</div>
    </div>
  );
}