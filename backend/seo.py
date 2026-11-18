"""Public discovery documents only; no database, customer or session data."""
from urllib.parse import quote
from xml.etree.ElementTree import Element, SubElement, tostring
from html import escape


def lead_image_preload(product, public):
    """Only preload an existing local lead photograph, never arbitrary input."""
    if not product:
        return ''
    images = product.get('images') or []
    source = next(iter(images), None) or product.get('image') or ''
    if not source.startswith('/images/mens/photo-') or not source.endswith('.jpg'):
        return ''
    name = source.rsplit('/', 1)[-1][:-4]
    if '/' in name or '..' in name:
        return ''
    urls = [f'/images/mens/optimized/{name}-{width}.webp' for width in (160, 600, 1200)]
    if not all((public / url.lstrip('/')).is_file() for url in urls):
        return ''
    srcset = ', '.join(f'{url} {width}w' for url, width in zip(urls, (160, 600, 1200)))
    return f'<link rel="preload" as="image" fetchpriority="high" href="{escape(urls[1], quote=True)}" imagesrcset="{escape(srcset, quote=True)}" imagesizes="(max-width: 768px) 100vw, 55vw">'


def sitemap(base_url, categories, products):
    paths = ['/', '/shop', '/coupons']
    paths += ['/shop/' + quote(str(category), safe='') for category in categories]
    paths += ['/products/' + quote(str(product['id']), safe='')
              for product in products if product.get('id')]
    root = Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for path in dict.fromkeys(paths):
        SubElement(SubElement(root, 'url'), 'loc').text = base_url.rstrip('/') + path
    return tostring(root, encoding='utf-8', xml_declaration=True)


def robots(base_url):
    private = ['/api/', '/admin', '/account', '/cart', '/login', '/wishlist', '/verify-email', '/access-denied']
    # Rendering crawlers need the public data fetched by the SPA, while private
    # account/payment/admin APIs remain excluded. Robots is not access control.
    return 'User-agent: *\nAllow: /api/products\nAllow: /api/coupons\n' + ''.join('Disallow: ' + path + '\n' for path in private) + 'Sitemap: ' + base_url.rstrip('/') + '/sitemap.xml\n'
