import "@testing-library/jest-dom";

// Node 22 ships the full Fetch API, but Jest's jsdom environment doesn't
// expose it on global. Firebase Auth requires fetch + Response + Request +
// Headers at module-load time, so bridge them all here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any;
if (!g.fetch)    g.fetch    = globalThis.fetch;
if (!g.Response) g.Response = globalThis.Response;
if (!g.Request)  g.Request  = globalThis.Request;
if (!g.Headers)  g.Headers  = globalThis.Headers;
