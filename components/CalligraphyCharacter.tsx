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
  // Generate a safe unique ID for the SVG filter to avoid collisions
  const filterId = useId().replace(/:/g, "");

  // 1. BASE NORMALIZATION
  // Always grayscale to ensure clean alpha math
  let cssFilters = "grayscale(1)";

  // If we are NOT removing the background, boost contrast to make the paper look clean
  if (!removeBg && !wireframe) {
    cssFilters += " contrast(200%) brightness(110%)";
  }

  // 2. BUILD THE FILTER CHAIN
  if (wireframe) {
    cssFilters += ` url(#edge-${filterId})`;
    cssFilters += invert ? ` url(#rb-white-${filterId})` : ` url(#rb-black-${filterId})`;
  } else if (removeBg) {
    // True background removal via Aggressive Alpha Crushing
    cssFilters += invert ? ` url(#rw-white-${filterId})` : ` url(#rw-black-${filterId})`;
  } else {
    // Standard opaque ink mode
    if (invert) cssFilters += " invert(1)";
  }

  return (
    <div 
      className={`relative overflow-hidden border border-[var(--border)] shadow-sm select-none rounded-lg transition-all duration-300 ${
        removeBg || wireframe ? "bg-transparent" : "bg-[var(--card-bg)]"
      }`}
      style={{ width: size, height: size }}
    >
      {/* MATHEMATICAL SVG FILTERS */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id={`edge-${filterId}`} colorInterpolationFilters="sRGB">
            <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1  -1 8 -1  -1 -1 -1" preserveAlpha="true" />
          </filter>

          {/* Remove White Paper -> Black Ink */}
          <filter id={`rw-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="crushed">
              {/* Steeper slope: Forces light-grays to 0 opacity, darks to 100% opacity */}
              <feFuncA type="linear" slope="-2.5" intercept="1.75" />
              <feFuncR type="linear" slope="0" intercept="0" />  {/* Force Black */}
              <feFuncG type="linear" slope="0" intercept="0" />
              <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>
            {/* Safety Mask: Prevents the transparent 'object-contain' space from generating borders */}
            <feComposite in="crushed" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Remove White Paper -> White Ink (Rubbing Style) */}
          <filter id={`rw-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="crushed">
              <feFuncA type="linear" slope="-2.5" intercept="1.75" />
              <feFuncR type="linear" slope="0" intercept="1" />  {/* Force White */}
              <feFuncG type="linear" slope="0" intercept="1" />
              <feFuncB type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
            <feComposite in="crushed" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Remove Black Background -> Black Lines (For Wireframe) */}
          <filter id={`rb-black-${filterId}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="crushed">
              <feFuncA type="linear" slope="2.5" intercept="-0.75" />
              <feFuncR type="linear" slope="0" intercept="0" />
              <feFuncG type="linear" slope="0" intercept="0" />
              <feFuncB type="linear" slope="0" intercept="0" />
            </feComponentTransfer>
            <feComposite in="crushed" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Remove Black Background -> White Lines (For Inverted Wireframe) */}
          <filter id={`rb-white-${filterId}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="crushed">
              <feFuncA type="linear" slope="2.5" intercept="-0.75" />
              <feFuncR type="linear" slope="0" intercept="1" />
              <feFuncG type="linear" slope="0" intercept="1" />
              <feFuncB type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
            <feComposite in="crushed" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      </svg>

      {/* THE GRID LAYER (z-0: Behind the ink) */}
      {grid !== "none" && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect width="100" height="100" fill="none" stroke="var(--accent)" strokeWidth="1" />
          {grid === "jiu" ? (
            <>
              <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
            </>
          ) : (
            <>
              <line x1="50" y1="0" x2="50" y2="100" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="0" x2="100" y2="100" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="100" y1="0" x2="0" y2="100" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2,2" />
            </>
          )}
        </svg>
      )}

      {/* THE INK LAYER (z-10: On top) */}
      <div className="absolute inset-0 p-2 z-10 flex items-center justify-center pointer-events-none">
        <img
          src={imageUrl}
          alt={char}
          className="w-full h-full object-contain transition-all duration-300"
          style={{ filter: cssFilters }}
        />
      </div>
    </div>
  );
}