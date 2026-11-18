"""Public asset/catalogue compression; authenticated/payment responses untouched."""
from starlette.middleware.gzip import GZipMiddleware


class PublicAssetMiddleware:
    def __init__(self, app):
        self.app = app
        self.compressed = GZipMiddleware(app, minimum_size=500, compresslevel=6)

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        compress = path.startswith(('/assets/', '/fonts/')) or path in ('/theme.js', '/favicon.svg', '/api/products', '/api/coupons')
        public = (compress and not path.startswith('/api/')) or path.startswith(('/images/', '/icons/'))

        async def cache(message):
            if message['type'] == 'http.response.start' and message['status'] == 200 and public:
                headers = list(message.get('headers', []))
                headers.append((b'cache-control', b'public, max-age=31536000, immutable' if path.startswith('/assets/') else b'public, max-age=86400'))
                message = {**message, 'headers': headers}
            await send(message)

        await (self.compressed if compress else self.app)(scope, receive, cache)
