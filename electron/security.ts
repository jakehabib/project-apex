/**
 * True only for URLs belonging to our own renderer. Compares scheme + host
 * explicitly: WHATWG URL.origin is the opaque string "null" for custom schemes
 * and file:, so origin equality would wrongly treat unrelated URLs as trusted.
 */
export function isTrustedAppUrl(raw: string, opts: { scheme: string; host: string; devUrl?: string | undefined }): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (opts.devUrl) {
    const dev = new URL(opts.devUrl);
    return url.protocol === dev.protocol && url.host === dev.host;
  }
  return url.protocol === `${opts.scheme}:` && url.host === opts.host && url.username === '' && url.password === '';
}
