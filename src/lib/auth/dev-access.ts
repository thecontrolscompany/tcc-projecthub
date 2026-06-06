export function isLocalhostDevelopmentRequest(host?: string | null) {
  if (process.env.NODE_ENV !== 'development') return false;
  if (!host) return false;

  const hostname = host.split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
