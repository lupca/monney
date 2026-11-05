// Vercel Routing Middleware: chặn cả trang và API bằng mật khẩu APP_PASSWORD.
export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const want = process.env.APP_PASSWORD;
  if (!want) return;
  const h = request.headers.get('authorization') || '';
  if (h.startsWith('Basic ')) {
    try {
      const raw = new TextDecoder().decode(Uint8Array.from(atob(h.slice(6)), c => c.charCodeAt(0)));
      const pass = raw.split(':').slice(1).join(':');
      if (pass === want) return;
    } catch { /* sai định dạng, coi như chưa đăng nhập */ }
  }
  return new Response('Cần mật khẩu', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="So tien", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
