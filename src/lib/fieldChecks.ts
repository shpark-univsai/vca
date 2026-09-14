import type { AppLanguage } from "./i18n";

/**
 * Format checks for the handful of fields whose correct shape is not a matter of opinion.
 *
 * Deliberately small. A check that is nearly right is worse than none: it refuses a value that
 * would have worked, in a console where the person typing knows their own network better than
 * this file does, and the only way past it is to lie to the form. So the rules here are limited
 * to the two that are settled by a standard rather than by a guess about this deployment —
 * a TCP port's range, and what a dotted-decimal address is. Everything else (hostnames, mail
 * domains on an isolated network, how a footage window should be written) is left alone on
 * purpose; see the notes on each function.
 *
 * Both return a CODE, not a sentence. Messages live in FIELD_CHECK_T below so the two callers of
 * a rule cannot end up phrasing it differently, and so a rule and its wording change together.
 */

/**
 * A TCP port: an integer in 1–65535. 0 exists in the registry but is reserved and never listened
 * on, so a form that accepts it is accepting a value nothing can connect to.
 *
 * Empty is not a problem here — every port field in Portal is optional or falls back to a default,
 * and "required" is the caller's question, not this one's.
 */
export function portProblem(value: string): "range" | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 65536 ? null : "range";
}

/**
 * Only speaks about text that is plainly MEANT to be a dotted-decimal address: every character a
 * digit or a dot. A hostname, an IPv6 address, a URL — anything carrying a letter or a colon — is
 * none of this function's business and comes back null, because a server on a customer's network
 * may legitimately be reached by name and this file has no standing to insist otherwise.
 *
 * Leading zeros are NOT refused. "192.168.001.5" is read as octal by some resolvers and as decimal
 * by others, which makes it a bad thing to type — but it is a real address that real equipment
 * prints, and refusing it would block a value the operator copied off the device itself.
 */
export function ipv4Problem(value: string): "parts" | "octet" | null {
  const v = value.trim();
  if (v === "" || !/^[0-9.]+$/.test(v)) return null;
  const parts = v.split(".");
  if (parts.length !== 4 || parts.some(p => p === "")) return "parts";
  if (parts.some(p => Number(p) > 255)) return "octet";
  return null;
}

export const FIELD_CHECK_T: Record<AppLanguage, Record<"range" | "parts" | "octet", string>> = {
  en: {
    range: "A port is a whole number from 1 to 65535.",
    parts: "An IPv4 address is four numbers separated by dots — 192.168.0.36.",
    octet: "Each part of an IPv4 address is 0 to 255.",
  },
  ko: {
    range: "포트는 1부터 65535까지의 정수입니다.",
    parts: "IPv4 주소는 점으로 나눈 숫자 네 마디입니다 — 192.168.0.36.",
    octet: "IPv4 주소의 각 마디는 0부터 255까지입니다.",
  },
};
