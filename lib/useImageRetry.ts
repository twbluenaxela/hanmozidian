"use client";
import { useState, useEffect, useRef } from "react";

type Status = "loading" | "loaded" | "failed";

/**
 * Auto-retries once with a cache-buster to absorb transient R2/network
 * drops on mobile. Callers wire `onLoad`/`onError` to an <img> and read
 * `status` to render a skeleton or fallback. `queryParam` keeps caller-
 * specific URLs on separate CDN cache entries (e.g. "cors=1" vs "gallery=1").
 */
export function useImageRetry(imageUrl: string, queryParam: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [retryToken, setRetryToken] = useState(0);
  const attemptRef = useRef(0);

  useEffect(() => {
    setStatus("loading");
    setRetryToken(0);
    attemptRef.current = 0;
  }, [imageUrl]);

  const onError = () => {
    if (attemptRef.current < 1) {
      attemptRef.current += 1;
      setTimeout(() => setRetryToken((t) => t + 1), 500);
    } else {
      setStatus("failed");
    }
  };

  const onLoad = () => setStatus("loaded");

  const src = imageUrl
    ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}${queryParam}${retryToken > 0 ? `&r=${retryToken}` : ""}`
    : "";

  return { status, src, onLoad, onError };
}
