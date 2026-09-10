// Redmap domain — person/vehicle search hit results.
// Currently returns the mock hits defined in RedmapPage.tsx, bound to one site's cameras.
// Swap the body of this function for a real fetch(`${API_BASE_URL}/...`) call later.

import { hitResultSetsForProject } from "@/components/RedmapPage";
import { getActiveProjectId } from "@/lib/vcaStore";
import { mockDelay } from "./client";

/**
 * Hits for one site. A sighting belongs to the camera that captured it, so which site is being
 * asked about is part of the question — the backend will need the same argument.
 */
export async function getHitResults(projectId: string = getActiveProjectId()) {
  return mockDelay(hitResultSetsForProject(projectId)[0]);
}
