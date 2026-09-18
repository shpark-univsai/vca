/**
 * THE FILES THIS TAB STILL HOLDS, so a preview can actually play something.
 *
 * An uploaded recording is not a live stream: the browser can play an mp4 by itself, with no relay
 * and no server (owner, 2026-09-18: 실시간이 아니라서 똑같이 보여주면 안 되는 건가?). What it
 * cannot do is play a file it does not have — and most rows in the register are files the server
 * holds, either seeded or uploaded on some earlier day.
 *
 * So this keeps the ones we do have: when somebody picks a file in Input Sources, the object URL
 * goes in here under the row's id, and the preview plays it for real. Everything else opens the
 * same preview with the play control and a line saying the file lives on the server — which is
 * the honest half of the mock, and the shape the download endpoint has to fill.
 *
 * NOT IN THE STORE, deliberately. An object URL is a pointer into this one document: it dies with
 * the tab, means nothing to another window, and cannot be serialised or sent anywhere. Putting it
 * in the store would make every future persistence layer carry a value that is invalid the moment
 * it is read back. A module Map is the correct lifetime for it.
 *
 * Nothing revokes these while the tab is open: the row they belong to can be previewed again at
 * any time, and revoking on close would break the second look. They go when the document goes,
 * which is also when the URLs stop meaning anything.
 */
const urls = new Map<string, string>();

/** Remember the file behind an upload row, as a URL a <video> or <img> can read. */
export function rememberUploadFile(uploadId: string, file: File): void {
  const previous = urls.get(uploadId);
  if (previous) URL.revokeObjectURL(previous);
  urls.set(uploadId, URL.createObjectURL(file));
}

/** The playable URL for an upload, or undefined when this browser does not hold the file. */
export function uploadFileUrl(uploadId: string): string | undefined {
  return urls.get(uploadId);
}

/** Dropped along with the row, so a deleted upload does not keep its file alive. */
export function forgetUploadFile(uploadId: string): void {
  const url = urls.get(uploadId);
  if (url) URL.revokeObjectURL(url);
  urls.delete(uploadId);
}
