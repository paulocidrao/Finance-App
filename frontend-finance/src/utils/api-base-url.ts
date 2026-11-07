export function resolveApiBaseUrl(configured: string | undefined, pageOrigin: string): string {
  if (configured) return new URL(configured, pageOrigin).href;
  const page = new URL(pageOrigin);
  if (page.hostname === 'localhost' || page.hostname === '127.0.0.1') {
    // Keep the cookie same-site when preview is opened with either local host.
    return `${page.protocol}//${page.hostname}:3000/`;
  }
  // Production can use a same-origin reverse proxy, or VITE_API_URL explicitly.
  return new URL('/api/', pageOrigin).href;
}