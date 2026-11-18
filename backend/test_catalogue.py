"""Catalogue tests import only pure data; no production database is opened."""
import json
import re
from pathlib import Path
from backend.catalogue import CATEGORIES, PRODUCTS, CATEGORY_WEIGHTS

ROOT = Path(__file__).resolve().parent.parent
ORIGINAL = json.loads((Path(__file__).parent / 'fixtures/original_catalogue_ids.json').read_text())


def test_catalogue_identities_prices_categories_and_copy():
    assert len(PRODUCTS) == len({p['id'] for p in PRODUCTS}) == len({p['price'] for p in PRODUCTS}) == 60
    assert len({p['compare_at'] for p in PRODUCTS}) == 60
    assert len({p['description'] for p in PRODUCTS}) == 60
    actual = {p['id']:p for p in PRODUCTS}
    for old in ORIGINAL:
        assert all(actual[old['id']][key] == old[key] for key in ('id','name','category'))
    assert len(ORIGINAL) == 50
    for category in CATEGORIES:
        assert len([p for p in PRODUCTS if p['category'] == category]) == 10
    for product in PRODUCTS:
        assert product['category'] in CATEGORIES
        assert 0 < product['price'] <= product['compare_at']
        assert len(product['description'].split('. ')) in (2,3)
        assert product['fabric'] and product['fit'] and 0 < product['weight_kg'] <= 1
        assert product['rating'] is None and product['review_count'] == 0
        assert all(c['name'] and re.fullmatch(r'#[0-9a-fA-F]{6}',c['hex']) for c in product['colors'])
        if product['category'] != 'Sportswear':
            assert product['weight_kg'] == CATEGORY_WEIGHTS[product['category']]


def test_sportswear_galleries_and_every_served_image_has_optimized_variants():
    for product in PRODUCTS:
        assert product['image'] in product['images']
        if product['category'] == 'Sportswear':
            assert 3 <= len(set(product['images'])) <= 5
            assert len(product['image_alts']) == len(product['images'])
        for url in product['images']:
            assert url.startswith('/images/mens/')
            path = ROOT / 'frontend/public' / url.lstrip('/')
            assert path.is_file() and path.stat().st_size > 0
            for width in (160,600,1200):
                variant = path.parent / 'optimized' / f'{path.stem}-{width}.webp'
                data = variant.read_bytes()
                assert data[:4] == b'RIFF' and data[8:12] == b'WEBP'


def test_old_saved_cart_ids_still_quote_and_historical_order_snapshot_is_unchanged():
    from backend.test_google_auth import GoogleEndpointTests
    GoogleEndpointTests().run_scenario('''
old = json.loads((Path('backend/fixtures/original_catalogue_ids.json')).read_text())
for start in (0,25):
    saved_cart = [{'product_id':p['id'],'size':'M','quantity':1} for p in old[start:start+25]]
    response = await client.post('/api/checkout/quote',json={'items':saved_cart})
    assert response.status_code == 200 and response.json()['subtotal'] > 0
uid = seed()
details = json.dumps({'items':[{'product_id':'everyday-hoodie','size':'M','quantity':1,'price':1990}],'address':'Historical address'})
with store.db() as c:
    c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)',('order_before_content',uid,199000,details,'paid','public-fixture'))
before = snapshot()['orders']
store.quote(store.Checkout(items=[store.Item(product_id='everyday-hoodie',size='M',quantity=1)]))
assert store.order_detail('order_before_content',{'id':uid})['details'] == details
assert store.order_detail('order_before_content',{'id':uid})['amount'] == 199000
assert snapshot()['orders'] == before
''')
