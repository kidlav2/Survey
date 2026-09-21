import type { VercelRequest, VercelResponse } from '@vercel/node';

export async function asFetch(
  req: VercelRequest,
  res: VercelResponse,
  fn: (request: Request) => Promise<Response>
) {
  const host = String(req.headers.host || 'localhost');
  const url = `https://${host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  const method = req.method || 'GET';
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});
  const request = new Request(url, { method, headers, body });
  const response = await fn(request);
  res.status(response.status);
  const setCookie =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (setCookie.length) res.setHeader('set-cookie', setCookie);
  else {
    const single = response.headers.get('set-cookie');
    if (single) res.setHeader('set-cookie', single);
  }
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  const text = await response.text();
  if (text) res.send(text);
  else res.end();
}
