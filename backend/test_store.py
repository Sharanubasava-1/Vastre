import os, tempfile, unittest, importlib, hmac, hashlib
from pathlib import Path
import asyncio
from fastapi import Request, Response, HTTPException
from unittest.mock import patch
from dataclasses import replace
import httpx

class StoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        environment=patch.dict(os.environ, {
            'VASTRE_DB':str(Path(cls.tmp.name)/'test.db'),
            'ADMIN_EMAIL':'admin@test.example',
            'ADMIN_PASSWORD':'testing-admin-password',
            'PYTHON_DOTENV_DISABLED':'1',
            'ALLOWED_ORIGINS':'http://localhost:5173,http://127.0.0.1:5173,https://shop.example.test',
            'SESSION_HOURS':'24',
            'COOKIE_SECURE':'false',
            'SMTP_HOST':'', 'REQUIRE_VERIFIED_EMAIL':'false',
        })
        environment.start()
        cls.addClassCleanup(environment.stop)
        cls.store=importlib.import_module('backend.app')
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def request(self,response=None):
        headers=[]
        if response: headers=[(b'cookie',response.headers['set-cookie'].split(';')[0].encode())]
        return Request({'type':'http','headers':headers})
    def test_account_and_admin_access(self):
        s=self.store
        response=Response()
        account=s.register(s.Credentials(email='customer@test.example',password='testing-password',name='Customer'),response)
        request=self.request(response)
        self.assertEqual(s.current_user(request)['role'],'user')
        with self.assertRaises(HTTPException) as denied:s.overview(request,s.admin_access(request,s.current_user(request)))
        self.assertEqual(denied.exception.status_code,403)
        with self.assertRaises(HTTPException):s.login(s.Credentials(email=account['email'],password='wrong-password'),Response())
        logged=Response()
        s.login(s.Credentials(email=account['email'],password='testing-password'),logged)
        self.assertEqual(s.current_user(self.request(logged))['email'],account['email'])
        s.logout(request,Response())
        with self.assertRaises(HTTPException):s.current_user(request)
        admin=Response()
        s.login(s.Credentials(email='admin@test.example',password='testing-admin-password'),admin)
        self.assertEqual(s.overview(self.request(admin),s.admin_access(self.request(admin),s.current_user(self.request(admin))))['customers'],1)
    def test_catalogue_and_coupons(self):
        s=self.store
        self.assertEqual(set(p['category'] for p in s.products()),set(s.CATEGORIES))
        self.assertEqual(len(s.products()), 60)
        self.assertEqual(len({p['id'] for p in s.products()}), 60)
        for category in s.CATEGORIES:
            collection = s.products(category)
            self.assertEqual(len(collection), 10)
            self.assertTrue(all(p['image'] and p['image'] in p['images'] for p in collection))
            for p in collection:
                self.assertEqual(s.product(p['id']), p)
        item=s.Item(product_id='linen-sun-shirt',size='M',quantity=3)
        result=s.quote(s.Checkout(items=[item],coupon='vastre10'))
        self.assertEqual(result['total'],5103)
        with self.assertRaises(HTTPException):s.quote(s.Checkout(items=[s.Item(product_id=item.product_id,size='M',quantity=1)],coupon='VASTRE10'))
        with self.assertRaises(HTTPException):s.quote(s.Checkout(items=[item],coupon='INVALID'))
        with self.assertRaises(HTTPException):s.quote(s.Checkout(items=[s.Item(product_id=item.product_id,size='invalid',quantity=1)]))
    def test_payment_verification(self):
        s=self.store
        response=Response()
        s.register(s.Credentials(email='payer@test.example',password='testing-password'),response)
        request=self.request(response)
        os.environ['RAZORPAY_KEY_ID']='test_key'
        os.environ['RAZORPAY_KEY_SECRET']='test_secret'
        data=s.Checkout(items=[s.Item(product_id='essential-tee',size='M',quantity=1)],address='Test address Bengaluru 560001')
        with patch.object(s,'razorpay',return_value={'id':'order_test','amount':99000}):s.create_order(data,request,s.current_user(request))
        v=s.Verification(razorpay_order_id='order_test',razorpay_payment_id='pay_test',razorpay_signature='invalid')
        with self.assertRaises(HTTPException):s.verify(v,request,s.current_user(request))
        v.razorpay_signature=hmac.new(b'test_secret',b'order_test|pay_test',hashlib.sha256).hexdigest()
        with patch.object(s,'razorpay',return_value={'order_id':'order_test','amount':99000,'currency':'INR','status':'authorized'}):
            with self.assertRaises(HTTPException):s.verify(v,request,s.current_user(request))
        with patch.object(s,'razorpay',return_value={'order_id':'order_test','amount':99000,'currency':'INR','status':'captured'}):
            self.assertEqual(s.verify(v,request,s.current_user(request))['status'],'paid')
            self.assertEqual(s.verify(v,request,s.current_user(request))['status'],'paid')
        self.assertEqual(s.orders(request,s.current_user(request))[0]['status'],'paid')

    def test_configuration_reaches_cors_and_new_session_lifetimes(self):
        s = self.store
        async def check_cors():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=s.app),
                                         base_url='http://testserver') as client:
                allowed = await client.options('/api/auth/login', headers={
                    'Origin': 'https://shop.example.test', 'Access-Control-Request-Method': 'POST',
                })
                self.assertEqual(allowed.status_code, 200)
                self.assertEqual(allowed.headers['access-control-allow-origin'], 'https://shop.example.test')
                self.assertEqual(allowed.headers['access-control-allow-credentials'], 'true')
                denied = await client.options('/api/auth/login', headers={
                    'Origin': 'https://foreign.example.test', 'Access-Control-Request-Method': 'POST',
                })
                self.assertEqual(denied.status_code, 400)
                self.assertNotIn('access-control-allow-origin', denied.headers)
        asyncio.run(check_cors())
        with patch.object(s, 'settings', replace(s.settings, session_hours=2)):
            response = Response()
            s.session(response, 1)
            cookie = response.headers['set-cookie']
            self.assertIn('Max-Age=7200', cookie)
            self.assertIn('HttpOnly', cookie)
            self.assertIn('SameSite=lax', cookie)
            self.assertNotIn('Secure;', cookie)
            token = cookie.split(';', 1)[0].split('=', 1)[1]
            with s.db() as connection:
                row = connection.execute('SELECT token, expires FROM sessions WHERE token=?',
                    (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
            self.assertIsNotNone(row)
            self.assertNotEqual(row['token'], token)
            self.assertAlmostEqual(row['expires'] - int(s.time.time()), 7200, delta=2)
if __name__=='__main__': unittest.main()
