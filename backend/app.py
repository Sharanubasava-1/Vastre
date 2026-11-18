from pathlib import Path
import os, sqlite3, hashlib, hmac, secrets, time, json, base64
from contextlib import contextmanager, nullcontext
from urllib.request import Request as URLRequest, urlopen
from urllib.error import URLError
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, ConfigDict, StrictBool
from typing import Literal
from backend.authorization import allowed, canonical_role, validate_user_change
from backend.config import load_settings
from backend.migrations import migrate
from backend.google_auth import verify_google_token, GoogleSignInFailed, FAILURE as GOOGLE_FAILURE
from backend.security import (audit, digest, peer_ip, validate_password, csrf_allowed,
    rate_limit, lockout_remaining, record_failure, too_many, security_headers)
from backend.email_delivery import send_email, EmailDeliveryUnavailable
from backend.seo import sitemap, robots
from backend.public_assets import PublicAssetMiddleware

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'frontend' / 'dist'
settings = load_settings()
DB = Path(os.getenv('VASTRE_DB', str(ROOT / 'backend' / 'store.db')))
app = FastAPI(title='Vastré Storefront')
app.add_middleware(PublicAssetMiddleware)

@contextmanager
def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()

def cleanup_sessions(c):
    c.execute('DELETE FROM sessions WHERE expires<=?', (int(time.time()),))


def log_admin_denial(request, uid=None):
    with db() as c:
        audit(c,'admin_access_denied',uid,request)


@app.exception_handler(RequestValidationError)
async def safe_validation_error(request, error):
    return JSONResponse({'detail':'Please check your details.'}, status_code=422)


def check_rate(path, email, request):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        ip = peer_ip(request) or ''
        if path == '/api/auth/login':
            wait = lockout_remaining(c,email,settings)
            wait = max(wait,rate_limit(c,'login:' + digest(ip + '\0' + email),settings.login_rate_per_min,60))
        elif path == '/api/auth/register':
            wait = rate_limit(c,'register:' + digest(ip),settings.register_rate_per_hour,3600)
        else:
            wait = rate_limit(c,'google:' + digest(ip),settings.google_rate_per_min,60)
    return wait


@app.middleware('http')
async def hardening(request: Request, call_next):
    response = None
    if request.url.path.startswith('/api/') and request.method in ('POST','PUT','PATCH','DELETE'):
        if not csrf_allowed(request,settings):
            if request.url.path.startswith('/api/admin/'):
                await run_in_threadpool(log_admin_denial,request)
            response = JSONResponse({'detail':'Request could not be verified. Refresh and try again.'},status_code=403)
        elif request.url.path in ('/api/auth/login','/api/auth/register','/api/auth/google'):
            try:
                body = await request.json()
                email = body.get('email','') if isinstance(body,dict) else ''
                email = email.strip().lower()[:254] if isinstance(email,str) else ''
            except (ValueError,UnicodeError):
                email = ''
            wait = await run_in_threadpool(check_rate, request.url.path, email, request)
            if wait:
                error = too_many(wait)
                response = JSONResponse({'detail':error.detail},status_code=429,headers=error.headers)
    if response is None:
        response = await call_next(request)
    return response


# CORS must also decorate CSRF/rate-limit errors for allowed cross-origin clients.
app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True, allow_methods=['*'], allow_headers=['*'], expose_headers=['Retry-After'])


@app.middleware('http')
async def response_security_headers(request: Request, call_next):
    response = await call_next(request)
    for name,value in security_headers(settings,os.getenv('COOKIE_SECURE') == 'true').items():
        response.headers[name] = value
    return response

with db() as c:
    migrate(c)
    cleanup_sessions(c)
    if os.getenv('ADMIN_EMAIL') and os.getenv('ADMIN_PASSWORD'):
        salt = secrets.token_hex(16)
        c.execute('INSERT OR IGNORE INTO users(name,email,salt,password,role,created_at) VALUES (?,?,?,?,?,?)', ('Admin',os.environ['ADMIN_EMAIL'].lower(),salt,password_hash(os.environ['ADMIN_PASSWORD'],salt),'admin',int(time.time())))

# Additive catalogue metadata; existing product identities remain stable.
from backend.catalogue import CATEGORIES, PRODUCTS

COUPONS = {'VASTRE10': {'percent':10,'minimum':4499}, 'WELCOME5': {'percent':5,'minimum':0}}

def current_user(request: Request):
    token = request.cookies.get('vastre_session','')
    with db() as c:
        now = int(time.time())
        hashed = digest(token)
        row = c.execute('''SELECT users.id,name,email,role,picture,auth_provider,email_verified,disabled,
            sessions.last_seen_at FROM users JOIN sessions ON users.id=sessions.user_id
            WHERE token=? AND expires>?''',(hashed,now)).fetchone()
        if row and (row['disabled'] or (row['role'] == 'admin' and row['last_seen_at'] is not None
                                       and row['last_seen_at'] <= now-settings.admin_idle_min*60)):
            c.execute('DELETE FROM sessions WHERE token=?',(hashed,))
            row = None
        if row:
            c.execute('UPDATE sessions SET last_seen_at=? WHERE token=?',(now,hashed))
    if not row:
        if request.scope.get('path','').startswith('/api/admin/'):
            with db() as c:
                audit(c,'admin_access_denied',request=request)
        raise HTTPException(401,'Please log in to continue.')
    return {key:row[key] for key in ('id','name','email','role','picture','auth_provider','email_verified')}


def require_permission(action):
    def dependency(request: Request, customer: dict = Depends(current_user)):
        if not allowed(customer['role'],action):
            with db() as c:
                audit(c,'admin_access_denied' if action.startswith('admin:') else 'permission_denied',customer['id'],request)
            raise HTTPException(403,'Admin access required.' if action.startswith('admin:') else 'Access denied.')
        return customer
    return dependency


def require_role(role):
    def dependency(request: Request, customer: dict = Depends(current_user)):
        if canonical_role(customer['role']) != canonical_role(role):
            with db() as c:
                audit(c,'admin_access_denied',customer['id'],request)
            raise HTTPException(403,'Admin access required.')
        return customer
    return dependency


admin_access = require_role('admin')
account_access = require_permission('account:self')
order_access = require_permission('orders:own')
checkout_access = require_permission('checkout:own')

class Credentials(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    password: str = Field(min_length=8,max_length=128)
    name: str = Field(default='Customer',min_length=1,max_length=80)

def session(response, uid, request=None, connection=None, expected_password=None):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    agent = request.headers.get('user-agent', '')[:200] if request is not None else None
    ip = str(request.client.host)[:45] if request is not None and request.client else None
    with (nullcontext(connection) if connection is not None else db()) as c:
        if connection is None:
            c.execute('BEGIN IMMEDIATE')
        active = c.execute('SELECT disabled,password FROM users WHERE id=?',(uid,)).fetchone()
        if not active or active['disabled'] or (expected_password is not None and active['password'] != expected_password):
            raise HTTPException(401,'Incorrect email or password.')
        cleanup_sessions(c)
        c.execute('''INSERT INTO sessions(token,user_id,expires,id,created_at,last_seen_at,user_agent,ip)
                     VALUES (?,?,?,?,?,?,?,?)''',
            (hashlib.sha256(token.encode()).hexdigest(),uid,now+settings.session_seconds,
             secrets.token_urlsafe(24),now,now,agent,ip))
        c.execute('UPDATE users SET last_login_at=? WHERE id=?', (now,uid))
    response.set_cookie('vastre_session',token,httponly=True,secure=os.getenv('COOKIE_SECURE')=='true',samesite='lax',max_age=settings.session_seconds)

@app.post('/api/auth/register')
def register(data: Credentials, response: Response, request: Request = None):
    validate_password(data.password)
    email = data.email.strip().lower()
    if '@' not in email: raise HTTPException(400,'Enter a valid email.')
    salt = secrets.token_hex(16)
    try:
        with db() as c:
            cur=c.execute('INSERT INTO users(name,email,salt,password,role,created_at) VALUES (?,?,?,?,?,?)',(data.name.strip(),email,salt,password_hash(data.password,salt),'user',int(time.time())))
            uid=cur.lastrowid
            audit(c,'register',uid,request)
    except sqlite3.IntegrityError:
        raise HTTPException(400,'Unable to create an account with these details. Try logging in or use another email.') from None
    session(response,uid,request)
    deliver_verification(uid)
    return dict(id=uid,name=data.name,email=email,role='user')

@app.post('/api/auth/login')
def login(data: Credentials,response: Response,request: Request = None):
    email = data.email.strip().lower()
    with db() as c:
        cleanup_sessions(c)
        remaining = lockout_remaining(c,email,settings)
        row=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
    if remaining:
        raise too_many(remaining)
    # Run PBKDF2 for unknown/Google-only accounts too; no password-user timing shortcut.
    candidate = password_hash(data.password,row['salt'] if row and row['salt'] else 'unused-login-salt')
    if not row or row['disabled'] or not row['salt'] or not row['password'] or not hmac.compare_digest(row['password'],candidate):
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            record_failure(c,email,settings)
            audit(c,'login_failure',request=request)
        raise HTTPException(401,'Incorrect email or password.')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        session(response,row['id'],request,connection=c,expected_password=row['password'])
        c.execute('DELETE FROM auth_failures WHERE key=?',(digest(email),))
        audit(c,'login_success',row['id'],request)
        current = c.execute('SELECT id,name,email,role FROM users WHERE id=?',(row['id'],)).fetchone()
    return dict(current)

def google_sign_in(token, response, request):
    try:
        profile = verify_google_token(token, settings.firebase_project_id)
    except GoogleSignInFailed:
        raise HTTPException(401, GOOGLE_FAILURE) from None
    now = int(time.time())
    ip = str(request.client.host)[:45] if request.client else None
    try:
        with db() as c:
            # Serialize lookup/link/create, including session and audit writes.
            c.execute('BEGIN IMMEDIATE')
            row = c.execute('SELECT * FROM users WHERE google_sub=?', (profile['sub'],)).fetchone()
            if row is None:
                row = c.execute('SELECT * FROM users WHERE lower(email)=?', (profile['email'],)).fetchone()
            if row is not None and row['disabled']:
                raise HTTPException(403, 'This account has been disabled.')
            if row is None:
                uid = c.execute('''INSERT INTO users
                    (name,email,salt,password,role,google_sub,picture,auth_provider,email_verified,created_at)
                    VALUES (?,?,NULL,NULL,'user',?,?,'google',1,?)''',
                    (profile['name'],profile['email'],profile['sub'],profile['picture'],now)).lastrowid
            else:
                uid = row['id']
                if row['google_sub'] and row['google_sub'] != profile['sub']:
                    raise HTTPException(401, GOOGLE_FAILURE)
                if not row['google_sub']:
                    provider = 'both' if row['salt'] and row['password'] else 'google'
                    c.execute('UPDATE users SET google_sub=?,auth_provider=? WHERE id=?',
                              (profile['sub'],provider,uid))
                    c.execute('INSERT INTO audit_log(ts,user_id,event,ip) VALUES (?,?,?,?)',
                              (now,uid,'google_link',ip))
                # Existing identity, email, password and role remain authoritative.
                c.execute('UPDATE users SET picture=?,email_verified=1 WHERE id=?', (profile['picture'],uid))
            session(response,uid,request,connection=c)
            c.execute('INSERT INTO audit_log(ts,user_id,event,ip) VALUES (?,?,?,?)',
                      (now,uid,'google_login',ip))
            customer = c.execute('SELECT id,name,email,role,picture FROM users WHERE id=?', (uid,)).fetchone()
            return dict(customer)
    except sqlite3.IntegrityError:
        raise HTTPException(401, GOOGLE_FAILURE) from None


@app.post('/api/auth/google')
async def google_login(request: Request, response: Response):
    # Parse here so malformed credentials never appear in validation-error responses.
    try:
        data = await request.json()
        token = data.get('id_token') if isinstance(data, dict) else None
    except (ValueError, UnicodeError):
        raise HTTPException(401, GOOGLE_FAILURE) from None
    return await run_in_threadpool(google_sign_in, token, response, request)

@app.get('/api/auth/me')
def me(request: Request, customer: dict = Depends(current_user)): return customer

@app.post('/api/auth/logout')
def logout(request: Request,response: Response):
    with db() as c:
        token = digest(request.cookies.get('vastre_session',''))
        row = c.execute('SELECT user_id FROM sessions WHERE token=?',(token,)).fetchone()
        c.execute('DELETE FROM sessions WHERE token=?',(token,))
        audit(c,'logout',row['user_id'] if row else None,request)
    response.delete_cookie('vastre_session')
    return {'ok':True}

@app.post('/api/auth/logout-all')
def logout_all(request: Request, response: Response, customer: dict = Depends(account_access)):
    with db() as c:
        c.execute('DELETE FROM sessions WHERE user_id=?',(customer['id'],))
        audit(c,'logout_all',customer['id'],request)
    response.delete_cookie('vastre_session')
    return {'ok':True}


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1,max_length=80)


@app.patch('/api/auth/profile')
def update_profile(data: ProfileUpdate, request: Request, customer: dict = Depends(account_access)):
    name = data.name.strip()
    if not name:
        raise HTTPException(400,'Enter your name.')
    with db() as c:
        c.execute('UPDATE users SET name=? WHERE id=? AND disabled=0',(name,customer['id']))
        audit(c,'profile_updated',customer['id'],request)
    # Email, provider and role cannot be changed through this endpoint.
    return {**customer,'name':name}


@app.get('/api/auth/sessions')
def list_sessions(request: Request, customer: dict = Depends(account_access)):
    current = digest(request.cookies.get('vastre_session',''))
    with db() as c:
        cleanup_sessions(c)
        rows = c.execute('''SELECT id,created_at,last_seen_at,user_agent,ip,token
            FROM sessions WHERE user_id=? ORDER BY created_at DESC''',(customer['id'],)).fetchall()
    return [{**{key:row[key] for key in ('id','created_at','last_seen_at','user_agent','ip')},
             'current':hmac.compare_digest(row['token'],current)} for row in rows]


@app.delete('/api/auth/sessions/{session_id}')
def revoke_session(session_id: str, request: Request, response: Response, customer: dict = Depends(account_access)):
    with db() as c:
        row = c.execute('SELECT token FROM sessions WHERE id=? AND user_id=?',(session_id,customer['id'])).fetchone()
        if not row:
            raise HTTPException(404,'Session not found.')
        c.execute('DELETE FROM sessions WHERE id=? AND user_id=?',(session_id,customer['id']))
        audit(c,'session_revoked',customer['id'],request)
    if hmac.compare_digest(row['token'],digest(request.cookies.get('vastre_session',''))):
        response.delete_cookie('vastre_session')
    return {'ok':True}


class FreshCredential(BaseModel):
    current_password: str = Field(default='',max_length=128)
    id_token: str = Field(default='',max_length=16384)


class PasswordUpdate(FreshCredential):
    new_password: str = Field(min_length=1,max_length=128)


def fresh_google_credential(token, row):
    try:
        profile = verify_google_token(token,settings.firebase_project_id)
    except GoogleSignInFailed:
        raise HTTPException(401,'Please sign in with Google again to continue.') from None
    timestamp = profile['auth_time']
    if (profile['sub'] != row['google_sub'] or isinstance(timestamp,bool)
        or not isinstance(timestamp,(int,float)) or not time.time()-300 <= timestamp <= time.time()+30):
        raise HTTPException(401,'Please sign in with Google again to continue.')


def reauthenticate(data,row):
    has_password = bool(row['salt'] and row['password'])
    if has_password:
        if not hmac.compare_digest(row['password'],password_hash(data.current_password,row['salt'])):
            raise HTTPException(401,'Incorrect email or password.')
    else:
        fresh_google_credential(data.id_token,row)


def update_password(data,request,response,customer,setting=False):
    validate_password(data.new_password)
    with db() as c:
        row = c.execute('SELECT * FROM users WHERE id=?',(customer['id'],)).fetchone()
    if setting and row['salt'] and row['password']:
        raise HTTPException(400,'Use change password for this account.')
    reauthenticate(data,row)
    salt = secrets.token_hex(16)
    hashed = password_hash(data.new_password,salt)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        # Recheck after PBKDF2 / Google I/O; a concurrent disable/change must win.
        latest = c.execute('SELECT * FROM users WHERE id=?',(customer['id'],)).fetchone()
        if latest['disabled'] or latest['password'] != row['password'] or latest['google_sub'] != row['google_sub']:
            raise HTTPException(401,'Please log in again to continue.')
        c.execute("UPDATE users SET salt=?,password=?,auth_provider=? WHERE id=?",
                  (salt,hashed,'both' if row['google_sub'] else 'password',customer['id']))
        # DB trigger revokes every session, including the current one.
        audit(c,'password_change',customer['id'],request)
    response.delete_cookie('vastre_session')
    return {'ok':True}


@app.post('/api/auth/change-password')
def change_password(data: PasswordUpdate, request: Request, response: Response, customer: dict = Depends(account_access)):
    return update_password(data,request,response,customer)


@app.post('/api/auth/set-password')
def set_password(data: PasswordUpdate, request: Request, response: Response, customer: dict = Depends(account_access)):
    return update_password(data,request,response,customer,setting=True)


@app.post('/api/auth/delete-account')
def delete_account(data: FreshCredential, request: Request, response: Response, customer: dict = Depends(account_access)):
    # Admin lifecycle guardrails/UI belong to Phase 5; this endpoint never removes admins.
    if customer['role'] == 'admin':
        raise HTTPException(403,'Admin accounts cannot be deleted here.')
    with db() as c:
        row = c.execute('SELECT * FROM users WHERE id=?',(customer['id'],)).fetchone()
    reauthenticate(data,row)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        latest = c.execute('SELECT * FROM users WHERE id=?',(customer['id'],)).fetchone()
        if (latest['disabled'] or latest['role'] == 'admin' or latest['password'] != row['password']
            or latest['google_sub'] != row['google_sub']):
            raise HTTPException(401,'Please log in again to continue.')
        c.execute('''UPDATE users SET name='Deleted customer',email=?,salt=NULL,password=NULL,
            google_sub=NULL,picture=NULL,email_verified=0,disabled=1 WHERE id=?''',
            (f'deleted-{secrets.token_hex(16)}@deleted.invalid',customer['id']))
        c.execute('DELETE FROM email_verifications WHERE user_id=?',(customer['id'],))
        audit(c,'account_deleted',customer['id'],request)
    response.delete_cookie('vastre_session')
    return {'ok':True}


def deliver_verification(uid, strict=False):
    token = secrets.token_urlsafe(32)
    with db() as c:
        row = c.execute('SELECT email,email_verified,disabled FROM users WHERE id=?',(uid,)).fetchone()
        if not row or row['email_verified'] or row['disabled']:
            return
        c.execute('''INSERT INTO email_verifications(token,user_id,expires) VALUES (?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET token=excluded.token,expires=excluded.expires''',
            (digest(token),uid,int(time.time())+settings.email_verification_hours*3600))
    try:
        send_email(row['email'],'Verify your Vastré email',
                   f'Confirm your email: {settings.public_base_url}/verify-email#token={token}')
    except EmailDeliveryUnavailable:
        with db() as c:
            audit(c,'email_delivery_failed',uid)
        if strict:
            raise HTTPException(503,'Email could not be sent. Please try again later.') from None


@app.post('/api/auth/send-verification')
def resend_verification(request: Request, customer: dict = Depends(account_access)):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        wait = rate_limit(c,'verify:' + str(customer['id']),settings.email_verification_rate_per_hour,3600)
    if wait:
        raise too_many(wait)
    deliver_verification(customer['id'],strict=True)
    return {'ok':True}


class EmailVerification(BaseModel):
    token: str = Field(min_length=1,max_length=128)


@app.post('/api/auth/verify-email')
def verify_email(data: EmailVerification,request: Request):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('''SELECT user_id FROM email_verifications JOIN users ON users.id=user_id
            WHERE token=? AND expires>? AND disabled=0''',(digest(data.token),int(time.time()))).fetchone()
        if not row:
            raise HTTPException(400,'This verification link is invalid or expired. Request another email.')
        c.execute('UPDATE users SET email_verified=1 WHERE id=?',(row['user_id'],))
        c.execute('DELETE FROM email_verifications WHERE user_id=?',(row['user_id'],))
        audit(c,'email_verified',row['user_id'],request)
    return {'ok':True}

@app.get('/api/products')
def products(category: str | None=None): return [p for p in PRODUCTS if not category or category=='View all' or p['category'].lower()==category.lower()]
@app.get('/api/products/{product_id}')
def product(product_id: str):
    found=next((p for p in PRODUCTS if p['id']==product_id),None)
    if not found: raise HTTPException(404,'Product not found.')
    return found
@app.get('/api/categories')
def categories(): return [dict(name=n,image=next(p['image'] for p in PRODUCTS if p['category']==n),eyebrow='The men’s edit') for n in CATEGORIES]
@app.get('/api/coupons')
def coupons(): return [dict(code=k,**v) for k,v in COUPONS.items()]

class Item(BaseModel):
    product_id: str
    size: str
    quantity: int = Field(ge=1,le=10)
class Checkout(BaseModel):
    items: list[Item] = Field(min_length=1,max_length=30)
    coupon: str = ''
    address: str = Field(default='',max_length=1000)

def quote(data):
    subtotal=0
    for item in data.items:
        p=product(item.product_id)
        if item.size not in p['sizes']: raise HTTPException(400,'Invalid size.')
        subtotal+=p['price']*item.quantity
    discount=0
    code=data.coupon.strip().upper()
    if code:
        coupon=COUPONS.get(code)
        if not coupon: raise HTTPException(400,'Coupon not found.')
        if subtotal<coupon['minimum']: raise HTTPException(400,f"This coupon requires an order of ₹{coupon['minimum']} or more.")
        discount=subtotal*coupon['percent']//100
    return dict(subtotal=subtotal,discount=discount,total=subtotal-discount,coupon=code)
@app.post('/api/checkout/quote')
def checkout_quote(data: Checkout): return quote(data)

def razorpay(path, payload=None):
    key,secret=os.getenv('RAZORPAY_KEY_ID'),os.getenv('RAZORPAY_KEY_SECRET')
    if not key or not secret: raise HTTPException(503,'Online payment is being configured. Please enquire on WhatsApp.')
    req=URLRequest('https://api.razorpay.com/v1/'+path, data=json.dumps(payload).encode() if payload is not None else None, headers={'Authorization':'Basic '+base64.b64encode(f'{key}:{secret}'.encode()).decode(),'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=20) as result: return json.load(result)
    except URLError: raise HTTPException(502,'Payment provider unavailable. Please try again.')
@app.post('/api/payments/order')
def create_order(data: Checkout, request: Request, customer: dict = Depends(checkout_access)):
    if settings.require_verified_email and not customer['email_verified']:
        raise HTTPException(403,'Please verify your email before checkout.')
    if len(data.address.strip())<10: raise HTTPException(400,'Please enter your delivery address.')
    total=quote(data)
    order=razorpay('orders',dict(amount=total['total']*100,currency='INR',receipt=secrets.token_hex(12)))
    with db() as c: c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)',(order['id'],customer['id'],order['amount'],data.model_dump_json(),'pending',None))
    return dict(order_id=order['id'],amount=order['amount'],currency='INR',key_id=os.environ['RAZORPAY_KEY_ID'])
class Verification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
@app.post('/api/payments/verify')
def verify(data: Verification,request: Request, customer: dict = Depends(order_access)):
    with db() as c: order=c.execute('SELECT * FROM orders WHERE id=? AND user_id=?',(data.razorpay_order_id,customer['id'])).fetchone()
    if not order: raise HTTPException(404,'Order not found.')
    expected=hmac.new(os.getenv('RAZORPAY_KEY_SECRET','').encode(),f"{order['id']}|{data.razorpay_payment_id}".encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,data.razorpay_signature): raise HTTPException(400,'Payment verification failed.')
    payment=razorpay('payments/'+data.razorpay_payment_id)
    if payment.get('order_id')!=order['id'] or payment.get('amount')!=order['amount'] or payment.get('currency')!='INR' or payment.get('status')!='captured': raise HTTPException(409,'Payment is awaiting capture. Contact us with your order ID.')
    with db() as c: c.execute("UPDATE orders SET status='paid',payment_id=? WHERE id=?",(data.razorpay_payment_id,order['id']))
    return {'status':'paid','order_id':order['id']}
@app.get('/api/orders')
def orders(request: Request, customer: dict = Depends(order_access)):
    with db() as c: rows=c.execute('SELECT * FROM orders WHERE user_id=?',(customer['id'],)).fetchall()
    return [dict(r) for r in rows]
@app.get('/api/admin/overview')
def overview(request: Request, customer: dict = Depends(admin_access)):
    with db() as c:
        orders=[dict(r) for r in c.execute('SELECT orders.*,users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.rowid DESC')]
        customers=c.execute("SELECT COUNT(*) FROM users WHERE role IN ('user','customer')").fetchone()[0]
    return dict(orders=orders,customers=customers,products=PRODUCTS,coupons=coupons())


@app.get('/api/orders/{order_id}')
def order_detail(order_id: str, customer: dict = Depends(order_access)):
    with db() as c:
        row = c.execute('SELECT * FROM orders WHERE id=? AND user_id=?',(order_id,customer['id'])).fetchone()
    if not row:
        raise HTTPException(404,'Order not found.')
    return dict(row)


USER_PUBLIC_COLUMNS = 'id,name,email,role,disabled,auth_provider,email_verified,created_at,last_login_at'


@app.get('/api/admin/users')
def admin_users(customer: dict = Depends(admin_access),
                page: int = Query(default=1,ge=1,le=1000000),
                page_size: int = Query(default=20,ge=1,le=100),
                search: str = Query(default='',max_length=254),
                role: Literal['','user','customer','support','admin'] = '',
                status: Literal['','active','disabled'] = '',
                provider: Literal['','password','google','both'] = ''):
    conditions, values = [], []
    if search.strip():
        escaped = search.strip().replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
        conditions.append("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')")
        values.extend([f'%{escaped}%'] * 2)
    if role:
        if canonical_role(role) == 'customer':
            conditions.append("role IN ('user','customer')")
        else:
            conditions.append('role=?')
            values.append(role)
    if status:
        conditions.append('disabled=?')
        values.append(int(status == 'disabled'))
    if provider:
        conditions.append('auth_provider=?')
        values.append(provider)
    where = ' WHERE ' + ' AND '.join(conditions) if conditions else ''
    with db() as c:
        total = c.execute('SELECT COUNT(*) FROM users' + where,values).fetchone()[0]
        rows = c.execute(f'SELECT {USER_PUBLIC_COLUMNS} FROM users' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?',
                         [*values,page_size,(page-1)*page_size]).fetchall()
        admins = c.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND disabled=0").fetchone()[0]
    return dict(users=[dict(row) for row in rows],total=total,page=page,page_size=page_size,
                pages=max(1,(total+page_size-1)//page_size),active_admins=admins)


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: Literal['user','customer','support','admin'] | None = None
    disabled: StrictBool | None = None


@app.patch('/api/admin/users/{user_id}')
def admin_update_user(user_id: int, data: AdminUserUpdate, request: Request,
                      customer: dict = Depends(admin_access)):
    if not data.model_fields_set or any(getattr(data,key) is None for key in data.model_fields_set):
        raise HTTPException(400,'Choose a role or account status to update.')
    denied = None
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        # Recheck privilege/session under the same lock as the update. A cached
        # dependency must not authorize a concurrent revoked/demoted admin.
        actor = c.execute('''SELECT users.role,disabled FROM users JOIN sessions ON sessions.user_id=users.id
            WHERE users.id=? AND token=? AND expires>?''',
            (customer['id'],digest(request.cookies.get('vastre_session','')),int(time.time()))).fetchone()
        if not actor or actor['disabled'] or actor['role'] != 'admin':
            audit(c,'admin_access_denied',customer['id'],request)
            denied = HTTPException(401 if not actor or actor['disabled'] else 403,'Admin access required.' if actor else 'Please log in to continue.')
        else:
            target = c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
            if not target:
                raise HTTPException(404,'User not found.')
            role = data.role if data.role is not None else target['role']
            disabled = data.disabled if data.disabled is not None else bool(target['disabled'])
            active_admins = c.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND disabled=0").fetchone()[0]
            validate_user_change(customer['id'],target,role,disabled,active_admins)
            changed_role, changed_status = role != target['role'], disabled != bool(target['disabled'])
            if changed_role or changed_status:
                c.execute('UPDATE users SET role=?,disabled=? WHERE id=?',(role,int(disabled),user_id))
                c.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
                if changed_role:
                    audit(c,'role_change',user_id,request,json.dumps({'actor_id':customer['id'],'from':target['role'],'to':role}))
                if changed_status:
                    audit(c,'account_disabled' if disabled else 'account_enabled',user_id,request,
                          json.dumps({'actor_id':customer['id'],'from':bool(target['disabled']),'to':disabled}))
            result = dict(c.execute(f'SELECT {USER_PUBLIC_COLUMNS} FROM users WHERE id=?',(user_id,)).fetchone())
    if denied:
        raise denied
    return result

@app.get('/theme.js')
def theme_script():
    return FileResponse(ROOT / 'frontend' / 'public' / 'theme.js',media_type='text/javascript')

@app.get('/sitemap.xml', include_in_schema=False)
def sitemap_document():
    return Response(sitemap(settings.public_base_url, CATEGORIES, PRODUCTS), media_type='application/xml')

@app.get('/robots.txt', include_in_schema=False)
def robots_document():
    return Response(robots(settings.public_base_url), media_type='text/plain')

@app.get('/manifest.webmanifest', include_in_schema=False)
def manifest_document():
    return FileResponse(ROOT / 'frontend' / 'public' / 'manifest.webmanifest', media_type='application/manifest+json')

@app.get('/favicon.svg', include_in_schema=False)
def favicon_document():
    return FileResponse(ROOT / 'frontend' / 'public' / 'favicon.svg', media_type='image/svg+xml')

app.mount('/icons', StaticFiles(directory=ROOT / 'frontend' / 'public' / 'icons'), name='icons')
app.mount('/fonts', StaticFiles(directory=ROOT / 'frontend' / 'public' / 'fonts'), name='fonts')
app.mount('/images', StaticFiles(directory=ROOT / 'frontend' / 'public' / 'images'), name='images')
if (DIST/'assets').exists(): app.mount('/assets',StaticFiles(directory=DIST/'assets'),name='assets')
@app.get('/{path:path}')
def storefront(path: str):
    if path.startswith('api/'): raise HTTPException(404,'Endpoint not found.')
    private = path.split('/')[0] in ('login','account','admin','cart','wishlist','verify-email','access-denied')
    html = (DIST/'index.html').read_text(encoding='utf-8')
    if path.startswith('products/'):
        from backend.seo import lead_image_preload
        product = next((p for p in PRODUCTS if str(p.get('id')) == path.removeprefix('products/')), None)
        html = html.replace('</head>', lead_image_preload(product, ROOT / 'frontend' / 'public') + '</head>')
    return HTMLResponse(html, headers={'Cache-Control': 'no-cache', **({'X-Robots-Tag': 'noindex, follow'} if private else {})})
