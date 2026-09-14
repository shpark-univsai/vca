// Registered VIP registry.
// Portal (a separate app) owns registration/CRUD for this — VCA only consumes it. This stub
// currently just wraps the locally-derived seed in `vcaStore.ts` (see `PERSONS` there) so the
// shape is documented for review, but it is NOT yet wired into the store: `useVcaStore`'s
// `persons` state is seeded synchronously at store creation (Zustand's `create()` runs before
// any fetch could resolve), and swapping that seed for a real async call from Portal's API is an
// architecture decision — response shape, and whether it replaces or merges with locally-detected
// entries — that needs to be settled with Portal's team first, not something to guess at here.

import { PERSONS } from "@/lib/vcaStore";
import { mockDelay } from "./client";

export async function getPersons() {
  return mockDelay(PERSONS);
}
