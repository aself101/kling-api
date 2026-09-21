/**
 * URL safety (SSRF) and key redaction (spec D12, run #2 A28).
 *
 * `assertSafeUrl` is the per-hop check `media/download.ts` runs on the initial URL and on
 * every redirect `Location`. It is strictly a TIME-OF-CHECK guard: the resolved address
 * is not pinned into the connection, so a host that rebinds between the check and the
 * fetch defeats it (pinning needs a custom undici `connect`; spec §12). Two policies are
 * deliberate and stated: an IP literal is checked without DNS; a hostname is resolved
 * with `dns.lookup({ all: true })` and REJECTED if ANY address is private, loopback,
 * link-local, multicast, unspecified or a cloud-metadata endpoint; a lookup failure
 * (`ENOTFOUND`, timeout) fails CLOSED. Import graph (§5): `config/constants`, siblings,
 * `node:*`.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BLOCKED_HOSTS } from './constants.js';

export type UrlRejection = 'invalid-url' | 'not-https' | 'blocked-host' | 'dns-failure';

/** Thrown by `assertSafeUrl`; `media/download.ts` wraps it in `KlingDownloadError('blocked-host')`. */
export class UnsafeUrlError extends Error {
  readonly reason: UrlRejection;
  readonly url: string;

  constructor(reason: UrlRejection, url: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UnsafeUrlError';
    this.reason = reason;
    this.url = url;
  }
}

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true });

export interface AssertSafeUrlOptions {
  /** Injectable for tests. Defaults to `dns.lookup({ all: true })`. */
  lookup?: LookupFn;
}

/**
 * Throws `UnsafeUrlError` unless `urlString` is an https URL whose host resolves only
 * to public unicast addresses. Returns the parsed URL.
 */
export async function assertSafeUrl(urlString: string, options: AssertSafeUrlOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (cause) {
    throw new UnsafeUrlError('invalid-url', urlString, `not a valid URL: ${JSON.stringify(urlString)}`, { cause });
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('not-https', urlString, `only https URLs are fetched (got ${url.protocol})`);

  // `new URL()` already normalises IPv4 spellings (0x7f000001, 2130706433, 0177.0.0.1 → 127.0.0.1)
  // and lower-cases the host; IPv6 literals keep their brackets.
  const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
  if (BLOCKED_HOSTS.includes(host) || host === 'localhost' || host.endsWith('.localhost')) {
    throw new UnsafeUrlError('blocked-host', urlString, `host ${host} is not allowed`);
  }

  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new UnsafeUrlError('blocked-host', urlString, `address ${host} is private, loopback, link-local or reserved`);
    return url;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await (options.lookup ?? defaultLookup)(host);
  } catch (cause) {
    throw new UnsafeUrlError('dns-failure', urlString, `could not resolve ${host} — failing closed`, { cause });
  }
  if (addresses.length === 0) throw new UnsafeUrlError('dns-failure', urlString, `${host} resolved to no addresses — failing closed`);
  const bad = addresses.find((a) => !isPublicAddress(a.address));
  if (bad) throw new UnsafeUrlError('blocked-host', urlString, `${host} resolves to ${bad.address}, which is private, loopback, link-local or reserved`);
  return url;
}

/** True for a globally routable unicast address; false for every reserved range this library refuses to fetch. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicV4(address);
  if (family === 6) return isPublicV6(address);
  return false;
}

function isPublicV4(a: string): boolean {
  const [o1, o2] = a.split('.').map(Number);
  if (o1 === 0 || o1 === 10 || o1 === 127) return false; // this-network, private, loopback
  if (o1 === 169 && o2 === 254) return false; // link-local (incl. cloud metadata 169.254.169.254)
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return false; // private
  if (o1 === 192 && o2 === 168) return false; // private
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return false; // shared address space (CGNAT)
  if (o1 >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function isPublicV6(a: string): boolean {
  const lower = a.toLowerCase();
  // IPv4-mapped (::ffff:1.2.3.4) and NAT64 (64:ff9b::1.2.3.4): judge the embedded v4.
  const mapped = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPublicV4(mapped[1]);
  const hextets = expandV6(lower);
  if (!hextets) return false;
  const first = hextets[0];
  if (hextets.every((h) => h === 0)) return false; // :: unspecified
  if (hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1) return false; // ::1
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  const embeddedV4 = `${hextets[6] >> 8}.${hextets[6] & 0xff}.${hextets[7] >> 8}.${hextets[7] & 0xff}`;
  // ::ffff:0:0/96 written in hex form (::ffff:7f00:1)
  if (hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff) return isPublicV4(embeddedV4);
  // ::/96 IPv4-compatible (deprecated, still routable on some stacks) in hex form (::7f00:1), and 64:ff9b::/96 NAT64 in hex form
  if (hextets.slice(0, 6).every((h) => h === 0)) return isPublicV4(embeddedV4);
  if (hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets.slice(2, 6).every((h) => h === 0)) return isPublicV4(embeddedV4);
  return true;
}

/** Eight 16-bit groups, or null when the literal cannot be expanded. */
function expandV6(a: string): number[] | null {
  const zone = a.indexOf('%');
  const addr = zone === -1 ? a : a.slice(0, zone);
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const parse = (s: string) => (s === '' ? [] : s.split(':').map((h) => parseInt(h, 16)));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const out = [...head, ...Array<number>(fill).fill(0), ...tail];
  return out.length === 8 && out.every((h) => Number.isInteger(h) && h >= 0 && h <= 0xffff) ? out : null;
}

// ============================================================================
// Key redaction
// ============================================================================

/** Last four characters only — for logs and `--debug` output. */
export function redactKey(key: string): string {
  if (!key || key.length <= 4) {
    return '****';
  }
  return `***${key.slice(-4)}`;
}
