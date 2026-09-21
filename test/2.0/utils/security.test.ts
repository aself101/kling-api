/** assertSafeUrl (spec D12, run #2 A28) — every reserved range with a public control; DNS injected. */
import { describe, expect, it } from 'vitest';
import { UnsafeUrlError, assertSafeUrl, isPublicAddress } from '../../../src/utils/security.js';

const resolves = (...addresses: string[]) => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
const fails = async () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }); };

async function rejection(url: string, lookup = resolves('93.184.216.34')) {
  try {
    await assertSafeUrl(url, { lookup });
    return undefined;
  } catch (e) {
    return e as UnsafeUrlError;
  }
}

describe('isPublicAddress', () => {
  it.each([
    ['127.0.0.1', false], ['10.1.2.3', false], ['192.168.0.1', false], ['172.16.0.1', false], ['172.31.255.255', false], ['172.32.0.1', true],
    ['169.254.169.254', false], ['0.0.0.0', false], ['100.64.0.1', false], ['100.128.0.1', true], ['224.0.0.1', false], ['255.255.255.255', false],
    ['93.184.216.34', true], ['8.8.8.8', true],
    ['::1', false], ['::', false], ['fc00::1', false], ['fd12::1', false], ['fe80::1', false], ['ff02::1', false],
    ['::ffff:127.0.0.1', false], ['::ffff:7f00:1', false], ['::ffff:8.8.8.8', true], ['64:ff9b::10.0.0.1', false],
    ['2606:4700::1111', true], ['2001:db8::1', true],
    ['not-an-ip', false],
  ])('%s → public: %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe('assertSafeUrl', () => {
  it('accepts an https URL whose host resolves only to public addresses (control)', async () => {
    const url = await assertSafeUrl('https://cdn.example/a.png', { lookup: resolves('93.184.216.34', '2606:4700::1111') });
    expect(url.hostname).toBe('cdn.example');
  });

  it('rejects http, and garbage', async () => {
    expect((await rejection('http://cdn.example/a.png'))?.reason).toBe('not-https');
    expect((await rejection('nope'))?.reason).toBe('invalid-url');
  });

  it('IP literals in every IPv4 spelling normalise and are checked without DNS', async () => {
    const lookupNotCalled = async () => { throw new Error('lookup must not be called for an IP literal'); };
    for (const u of ['https://127.0.0.1/', 'https://0x7f000001/', 'https://2130706433/', 'https://0177.0.0.1/', 'https://127.1/', 'https://169.254.169.254/latest/meta-data/']) {
      const err = await rejection(u, lookupNotCalled);
      expect(err?.reason, u).toBe('blocked-host');
    }
    await expect(assertSafeUrl('https://8.8.8.8/x', { lookup: lookupNotCalled })).resolves.toBeInstanceOf(URL);
  });

  it('IPv6 literals: loopback, ULA, link-local, mapped v4', async () => {
    for (const u of ['https://[::1]/', 'https://[fc00::1]/', 'https://[fe80::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[::ffff:7f00:1]/']) {
      expect((await rejection(u))?.reason, u).toBe('blocked-host');
    }
    await expect(assertSafeUrl('https://[2606:4700::1111]/', { lookup: fails })).resolves.toBeInstanceOf(URL);
  });

  it('hostnames: rejected if ANY resolved address is private (rebinding/dual records); metadata names by name', async () => {
    expect((await rejection('https://evil.example/', resolves('93.184.216.34', '10.0.0.5')))?.message).toMatch(/resolves to 10.0.0.5/);
    expect((await rejection('https://localhost/'))?.reason).toBe('blocked-host');
    expect((await rejection('https://foo.localhost/'))?.reason).toBe('blocked-host');
    expect((await rejection('https://metadata.google.internal/'))?.reason).toBe('blocked-host');
  });

  it('DNS failure and empty answers fail CLOSED with the lookup error as cause', async () => {
    const err = await rejection('https://gone.example/', fails);
    expect(err?.reason).toBe('dns-failure');
    expect((err?.cause as { code: string }).code).toBe('ENOTFOUND');
    expect((await rejection('https://empty.example/', resolves()))?.reason).toBe('dns-failure');
  });
});

describe('isPublicAddress — hex-embedded v4 forms (ship run #4)', () => {
  it.each([
    ['::7f00:1', false], // IPv4-compatible (deprecated) hex form of ::127.0.0.1
    ['64:ff9b::7f00:1', false], // NAT64 hex form of 127.0.0.1
    ['::ffff:7f00:1', false],
    ['::0808:0808', true], // IPv4-compatible hex form of 8.8.8.8 — public
    ['::8.8.8.8', false], // dotted IPv4-compatible does not parse as hextets → refused (fail closed)
  ])('%s → public: %s', (a, expected) => {
    expect(isPublicAddress(a)).toBe(expected);
  });
});
