import asyncio
import gzip
import pytest
from backend.public_assets import PublicAssetMiddleware


@pytest.mark.parametrize('path,compressed,cached', [
    ('/assets/app.js', True, True), ('/fonts/demo.ttf', True, True),
    ('/images/hero.webp', False, True), ('/api/auth/me', False, False), ('/account', False, False),
    ('/api/products', True, False), ('/api/coupons', True, False),
])
def test_only_public_assets_compress_and_cache(path, compressed, cached):
    messages = []
    body = b'a' * 2048

    async def app(scope, receive, send):
        await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'text/plain'),(b'x-content-type-options',b'nosniff')]})
        await send({'type':'http.response.body','body':body})

    async def receive():
        return {'type':'http.request','body':b''}

    async def send(message):
        messages.append(message)

    asyncio.run(PublicAssetMiddleware(app)({'type':'http','method':'GET','path':path,'headers':[(b'accept-encoding',b'gzip')]}, receive, send))
    headers = dict(messages[0]['headers'])
    assert (headers.get(b'content-encoding') == b'gzip') == compressed
    assert (b'cache-control' in headers) == cached
    assert headers[b'x-content-type-options'] == b'nosniff'
    payload = b''.join(message.get('body',b'') for message in messages[1:])
    assert (gzip.decompress(payload) if compressed else payload) == body
