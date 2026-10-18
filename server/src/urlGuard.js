import { lookup } from 'node:dns/promises';
import net from 'node:net';

function isPrivateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
    return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  return true;
}

// 로컬 테스트 전용: 내부망 주소 검사를 끈다 (운영에서는 설정하지 않는다)
export const allowPrivate = () => process.env.CAPTURE_ALLOW_PRIVATE === '1';

/** Throws if the URL is not a public http(s) URL. Returns the normalized URL string. */
export async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('올바른 URL이 아닙니다');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('http/https 주소만 가능합니다');
  }
  if (allowPrivate()) return u.toString();
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error('내부 네트워크 주소는 캡처할 수 없습니다');
  }
  return u.toString();
}
