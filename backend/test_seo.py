from xml.etree.ElementTree import fromstring
from backend.seo import sitemap, robots


def test_sitemap_contains_only_public_routes_escapes_and_deduplicates():
    result = sitemap('https://shop.example.test/', ['Shirts', 'T-shirts'], [{'id':'linen'}, {'id':'linen'}, {'id':'a&b'}, {}])
    root = fromstring(result)
    urls = [node.text for node in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert len(urls) == len(set(urls)) == 7
    assert 'https://shop.example.test/products/a%26b' in urls
    assert 'https://shop.example.test/shop/T-shirts' in urls
    assert all(not any(private in url for private in ('/admin','/account','/cart','/login')) for url in urls)


def test_robots_lists_private_routes_and_configured_sitemap_origin():
    result = robots('https://shop.example.test/')
    assert 'Disallow: /api/' in result and 'Disallow: /admin' in result
    assert 'Allow: /api/products\n' in result and 'Allow: /api/coupons\n' in result
    assert result.endswith('Sitemap: https://shop.example.test/sitemap.xml\n')


def test_explicit_discovery_routes_mime_types_and_private_noindex():
    # The existing helper creates/guards a fresh temporary database before import.
    from backend.test_google_auth import GoogleEndpointTests
    GoogleEndpointTests().run_scenario('''
response = await client.get('/sitemap.xml')
assert response.status_code == 200 and 'application/xml' in response.headers['content-type']
assert '/products/linen-sun-shirt' in response.text and '/admin' not in response.text
assert 'text/plain' in (await client.get('/robots.txt')).headers['content-type']
assert 'application/manifest+json' in (await client.get('/manifest.webmanifest')).headers['content-type']
assert 'image/svg+xml' in (await client.get('/favicon.svg')).headers['content-type']
assert 'image/png' in (await client.get('/icons/icon-192.png')).headers['content-type']
for path in ('/cart','/login','/account','/admin/users'):
    assert 'noindex' in (await client.get(path)).headers['x-robots-tag']
assert 'x-robots-tag' not in (await client.get('/products/linen-sun-shirt')).headers
assert (await client.get('/')).headers['cache-control'] == 'no-cache'
product_html = (await client.get('/products/linen-sun-shirt')).text
assert 'fetchpriority="high"' in product_html and 'imagesrcset=' in product_html
assert 'imagesrcset=' not in (await client.get('/cart')).text
''')
