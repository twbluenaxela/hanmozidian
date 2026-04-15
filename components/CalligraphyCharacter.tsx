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
}

export default function CalligraphyCharacter({
  imageUrl,
  char,
  grid = "none",
  invert = false,
  wireframe = false,
  removeBg = false,
  size = 128,
}: CalligraphyCharacterProps) {
  const filterId = useId().replace(/:/g, "");

  // Selection Logic
  let filterUrl = "";
  if (wireframe) {
    filterUrl = invert ? `url(#wire-white-${filterId})` : `url(#wire-black-${filterId})`;
  } else if (removeBg) {
    filterUrl = invert ? `url(#ink-white-${filterId})` : `url(#ink-black-${filterId})`;
  }

  // CSS fallback for standard opaque mode
  const baseCssFilter = (!wireframe && !removeBg) 
    ? (invert ? "grayscale(1) invert(1) contrast(150%)" : "grayscale(1) contrast(200%) brightness(110%)")
    : "none";

  return (
    <div 
      className={`relative overflow-hidden border border-[var(--border)] shadow-sm select-none rounded-lg transition-all duration-300 ${
        removeBg || wireframe ? "bg-transparent" : "bg-[var(--card-bg)]"
      }`}
      style={{ width: size, height: size }}
    >
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          {/* SHARED COMPONENT: A solid white background to neutralize image edge artifacts */}
          <filter id={`cleanup-${filterId}`}>
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
          </filter>

          {/* 1. INK BLACK (Transparent BG, Black Ink) */}
          <filter id={`ink-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            {/* Convert luminance to alpha (inverted so white=transparent) */}
            <feColorMatrix in="cleanImage" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" result="alpha" />
            <feComponentTransfer in="alpha">
              <feFuncA type="linear" slope="4" intercept="-2.8" /> {/* High contrast alpha to kill edge gray */}
              <feFuncR type="linear" slope="0" intercept="0" />
              <feFuncG type="linear" slope="0" intercept="0" />
              <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>
          </filter>

          {/* 2. INK WHITE (Transparent BG, White Ink) */}
          <filter id={`ink-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feColorMatrix in="cleanImage" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 -1 -1 1 1" result="alpha" />
            <feComponentTransfer in="alpha">
              <feFuncA type="linear" slope="4" intercept="-2.8" />
              <feFuncR type="linear" slope="0" intercept="1" />
              <feFuncG type="linear" slope="0" intercept="1" />
              <feFuncB type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
          </filter>

          {/* 3. WIREFRAME BLACK (Transparent BG, Black Outline) */}
          <filter id={`wire-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feConvolveMatrix in="cleanImage" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" />
            {/* Map edges to alpha and force RGB to black */}
            <feColorMatrix in="edges" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0" />
            <feComponentTransfer>
               <feFuncA type="linear" slope="2.5" intercept="-0.1" />
               <feFuncR type="linear" slope="0" intercept="0" />
               <feFuncG type="linear" slope="0" intercept="0" />
               <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>
          </filter>

          {/* 4. WIREFRAME WHITE (Transparent BG, White Outline) */}
          <filter id={`wire-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor="white" result="whiteBG" />
            <feComposite in="SourceGraphic" in2="whiteBG" operator="over" result="cleanImage" />
            <feConvolveMatrix in="cleanImage" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" />
            <feColorMatrix in="edges" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 1 1 0 0" />
            <feComponentTransfer>
               <feFuncA type="linear" slope="2.5" intercept="-0.1" />
               <feFuncR type="linear" slope="0" intercept="1" />
               <feFuncG type="linear" slope="0" intercept="1" />
               <feFuncB type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* THE GRID LAYER */}
      {grid !== "none" && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
          {grid === "jiu" ? (
            <>
              <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="66.6" y1="0" x2="66.6" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="66.6" x2="100" y2="66.6" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
            </>
          ) : (
            <>
              <line x1="50" y1="0" x2="50" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="0" x2="100" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="100" y1="0" x2="0" y2="100" stroke="var(--accent)" strokeWidth="0.2" strokeDasharray="1,1" />
            </>
          )}
        </svg>
      )}

      {/* THE INK LAYER */}
      <div className="absolute inset-0 p-4 z-10 flex items-center justify-center pointer-events-none">
        <img
          src={imageUrl}
          alt={char}
          className="w-full h-full object-contain transition-all duration-300"
          style={{ 
            filter: filterUrl ? filterUrl : baseCssFilter 
          }}
        />
      </div>
    </div>
  );
}