"use client";

import React, { useId } from "react";

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
        </defs>
      </svg>

      {grid !== "none" && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
          {grid === "jiu" ? (
            <><line x1="33.3" y1="0" x2="33.3" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="66.6" y1="0" x2="66.6" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="0" y1="33.3" x2="100" y2="33.3" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="0" y1="66.6" x2="100" y2="66.6" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /></>
          ) : (
            <><line x1="50" y1="0" x2="50" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="0" y1="50" x2="100" y2="50" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="0" y1="0" x2="100" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /><line x1="100" y1="0" x2="0" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" /></>
          )}
        </svg>
      )}

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[85%] h-[85%] flex items-center justify-center"> {/* Constrain size to 85% to act as padding */}
          <img
            src={`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}cors=1`}
            alt={char}
            className="max-w-full max-h-full object-contain transition-all duration-300"
            crossOrigin="anonymous" 
            style={{ 
              filter: filterUrl ? filterUrl : baseCssFilter,
              // Optional: slight nudge if your specific scans are always bottom-heavy
              // transform: 'translateY(-2%)' 
            }}
          />
        </div>
      </div>
    </div>
  );
}