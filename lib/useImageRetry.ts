"use client";
import { useState, useEffect, useRef } from "react";

type Status = "loading" | "loaded" | "failed";

// Session-scoped cache of successfully loaded base URLs (imageUrl?queryParam).
// Prevents re-showing skeleton when the same image appears again after a
// component re-render or filter change that didn't actually change the URL.
const loadedUrls = new Set<string>();

/** Exposed only for test isolation — clears the session cache between tests. */
export function clearImageCache() { loadedUrls.clear(); }

function baseUrl(imageUrl: string, queryParam: string) {
  if (!imageUrl) return "";
  return `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}${queryParam}`;
}

/**
 * Auto-retries once with a cache-buster to absorb transient R2/network
 * drops on mobile. Callers wire `onLoad`/`onError` to an <img> and read
 * `status` to render a skeleton or fallback. `queryParam` keeps caller-
 * specific URLs on separate CDN cache entries (e.g. "cors=1" vs "gallery=1").
 */
export function useImageRetry(imageUrl: string, queryParam: string) {
  const cached = imageUrl ? loadedUrls.has(baseUrl(imageUrl, queryParam)) : false;
  const [status, setStatus] = useState<Status>(cached ? "loaded" : "loading");
  const [retryToken, setRetryToken] = useState(0);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (imageUrl && loadedUrls.has(baseUrl(imageUrl, queryParam))) {
      setStatus("loaded");
      setRetryToken(0);
      attemptRef.current = 0;
      return;
    }
    setStatus("loading");
    setRetryToken(0);
    attemptRef.current = 0;
  }, [imageUrl, queryParam]);

  const onError = () => {
    if (attemptRef.current < 1) {
      attemptRef.current += 1;
      setTimeout(() => setRetryToken((t) => t + 1), 500);
    } else {
      setStatus("failed");
    }
  };

  const onLoad = () => {
    loadedUrls.add(baseUrl(imageUrl, queryParam));
    setStatus("loaded");
  };

  const src = imageUrl
    ? `${baseUrl(imageUrl, queryParam)}${retryToken > 0 ? `&r=${retryToken}` : ""}`
    : "";

  return { status, src, onLoad, onError };
}
