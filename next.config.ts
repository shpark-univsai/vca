import type { NextConfig } from "next";

/**
 * A development-only passthrough to whatever backend is currently reachable, so questions about
 * the API can be answered by asking it rather than by waiting for a reply.
 *
 * THIS IS NOT THE INTEGRATION. Nothing in `src/` may call it, and nothing about the server's shape
 * — no types, no field mapping, no "we'll need this later" adapter — belongs in the codebase yet:
 * the core is being rebuilt by somebody else, and a screen fitted to the first draft loses its
 * original intent when the second draft renames a field. This is a pipe for probing, and the
 * moment it starts feeding a component it has stopped being one.
 *
 * Why a rewrite rather than a route handler: a rewrite is configuration, not code. There is no
 * file to import by accident, nothing to unit-test, and with the variable unset it does not exist.
 *
 * Why the address lives in .env.local: it is one machine on one office network today, and it will
 * not be that machine tomorrow. A hardcoded 192.168.x.y in a committed file is a fact about
 * somebody's desk, and it goes stale silently — the proxy would keep answering, with nothing.
 *
 * Reads only, and not by our choice: the upstream answers 405 to every POST except login. Worth
 * knowing rather than discovering — this pipe cannot write anything even if something tried.
 *
 *   .env.local:  BACKEND_PROBE_URL=http://192.168.0.135:8088/api
 *   then:        curl http://localhost:3000/probe/locations
 *
 * Not NEXT_PUBLIC_: the browser has no business knowing an internal address, and a NEXT_PUBLIC_
 * variable is compiled into the bundle a customer receives.
 */
function probeRewrites() {
  const upstream = process.env.BACKEND_PROBE_URL?.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" || !upstream) return [];
  return [{ source: "/probe/:path*", destination: `${upstream}/:path*` }];
}

const nextConfig: NextConfig = {
  async rewrites() {
    return probeRewrites();
  },
};

export default nextConfig;
