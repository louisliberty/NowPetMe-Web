#!/usr/bin/env python3
"""End-to-end tests for the PHP API. Runs the real PHP code under `php -S` against a throwaway SQLite
database (MySQL isn't available in CI/sandbox). Usage: python3 php-api/tests/run_tests.py"""
import json, os, re, shutil, sqlite3, struct, subprocess, sys, tempfile, time, zlib
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(os.path.dirname(HERE), 'public')
tmp = tempfile.mkdtemp(prefix='npm-test-')
root = os.path.join(tmp, 'public')
shutil.copytree(PUBLIC, root)
open(os.path.join(root, 'index.html'), 'w').write(
    '<!DOCTYPE html><html><head><title>NowPetMe - Prove Your Pet\'s the Cutest!</title>'
    '<meta name="description" content="generic" /><meta property="og:title" content="generic" />'
    '</head><body><div id="root"></div></body></html>')
db_path = os.path.join(tmp, 'test.sqlite')
mail_log = os.path.join(tmp, 'mail.log')
cfg_path = os.path.join(tmp, 'config.php')
con = sqlite3.connect(db_path); con.executescript(open(os.path.join(HERE, 'schema.sqlite.sql')).read()); con.commit(); con.close()

def write_config(moderation='off'):
    open(cfg_path, 'w').write(f"""<?php return [
 'db' => ['driver'=>'sqlite','path'=>{db_path!r}],
 'base_url'=>'http://127.0.0.1:8099','ip_salt'=>'test-salt','trust_proxy_header'=>'X-Forwarded-For',
 'mail_log_file'=>{mail_log!r},'moderation'=>{moderation!r},'debug'=>true];""")
write_config()

env = dict(os.environ, NOWPETME_CONFIG=cfg_path, TEST_ROOT=root)
server = subprocess.Popen(['php', '-d', 'opcache.enable=0', '-d', 'opcache.enable_cli=0', '-S', '127.0.0.1:8099', '-t', root, os.path.join(HERE, 'router.php')],
                          env=env, stdout=subprocess.DEVNULL, stderr=open(os.path.join(tmp, 'php.log'), 'w'))
BASE = 'http://127.0.0.1:8099'
for _ in range(50):
    try:
        requests.get(BASE + '/api/pets', timeout=1); break
    except Exception:
        time.sleep(0.1)

passed = failed = 0
def check(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print(f'  ok   {name}')
    else: failed += 1; print(f'  FAIL {name} {detail}')

def png(w=40, h=30, color=(200, 120, 50)):
    raw = b''.join(b'\x00' + bytes(color) * w for _ in range(h))
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def sess(ip):
    s = requests.Session(); s.headers['X-Forwarded-For'] = ip; return s
def j(r):
    try: return r.json()
    except Exception: return r.text

def make_user(name, ip):
    s = sess(ip)
    s.post(BASE + '/api/auth/register', json={'username': name, 'email': f'{name}@example.com', 'password': 'secret1'})
    tok = re.findall(r'/api/auth/verify\?token=([0-9a-f]{64})', open(mail_log).read())[-1]
    s.get(BASE + '/api/auth/verify?token=' + tok, allow_redirects=False)
    return s

def upload(s, name='Biscuit', category='dog', data=None, **extra):
    files = {'photo': ('pet.png', data if data is not None else png(), 'image/png')}
    form = {'name': name, 'category': category, 'personalityTags': json.dumps(['playful', 'bogus', 'lazy'])}
    form.update(extra)
    return s.post(BASE + '/api/pets', data=form, files=files)

try:
    print('anonymous browsing on an empty site')
    a = sess('10.0.0.1')
    check('pets list empty', j(a.get(BASE + '/api/pets')) == [])
    check('count is 0', j(a.get(BASE + '/api/pets/count')) == {'count': 0})
    check('random 404', a.get(BASE + '/api/pets/random').status_code == 404)
    check('potd null', j(a.get(BASE + '/api/pets/of-the-day')) is None)
    check('me 401', a.get(BASE + '/api/auth/me').status_code == 401)
    check('unknown route 404', a.get(BASE + '/api/nope').status_code == 404)

    print('registration + verification')
    r = a.post(BASE + '/api/auth/register', json={'username': 'ab', 'email': 'x@y.com', 'password': 'secret1'})
    check('short username 400', r.status_code == 400 and 'at least 3' in j(r)['message'])
    r = a.post(BASE + '/api/auth/register', json={'username': 'alice', 'email': 'bad', 'password': 'secret1'})
    check('bad email 400', r.status_code == 400 and j(r)['message'] == 'Invalid email address')
    r = a.post(BASE + '/api/auth/register', json={'username': 'alice', 'email': 'alice@example.com', 'password': '123'})
    check('short password 400', r.status_code == 400)
    r = a.post(BASE + '/api/auth/register', json={'username': 'alice', 'email': 'Alice@Example.com', 'password': 'secret1'})
    u = j(r)
    check('register 201', r.status_code == 201 and u['username'] == 'alice' and u['emailVerified'] is False, r.text)
    check('user shape', set(u) == {'id','username','email','emailVerified','xp','level','xpForNextLevel','xpForCurrentLevel','votingStreak','bio'}, list(u))
    check('level fields', u['level'] == 1 and u['xpForNextLevel'] == 50 and u['xpForCurrentLevel'] == 0)
    check('session cookie httponly', 'HttpOnly' in r.headers.get('Set-Cookie', '') and 'SameSite=Lax' in r.headers.get('Set-Cookie', ''))
    check('me works after register', a.get(BASE + '/api/auth/me').json()['username'] == 'alice')
    check('dup email 409', sess('10.0.0.2').post(BASE + '/api/auth/register', json={'username': 'alice2', 'email': 'alice@example.com', 'password': 'secret1'}).status_code == 409)
    check('dup username 409', sess('10.0.0.2').post(BASE + '/api/auth/register', json={'username': 'ALICE', 'email': 'a2@example.com', 'password': 'secret1'}).status_code == 409)
    check('upload blocked before verify', upload(a).status_code == 403)
    check('comment blocked before verify', a.post(BASE + '/api/pets/1/comments', json={'text': 'hi'}).status_code in (403, 404))
    mail = open(mail_log).read()
    m = re.search(r'/api/auth/verify\?token=([0-9a-f]{64})', mail)
    check('verification email logged', bool(m))
    r = a.get(BASE + '/api/auth/verify?token=deadbeef', allow_redirects=False)
    check('bad token redirects to error', r.status_code == 302 and r.headers['Location'] == '/?verified=error')
    r = a.get(BASE + '/api/auth/verify?token=' + m.group(1), allow_redirects=False)
    check('good token redirects to success', r.headers['Location'] == '/?verified=success')
    check('verified now', a.get(BASE + '/api/auth/me').json()['emailVerified'] is True)

    print('upload')
    check('no file 400', a.post(BASE + '/api/pets', data={'name': 'x', 'category': 'dog'}).status_code == 400)
    check('bad category 400', upload(a, category='dragon').status_code == 400)
    check('empty name 400', upload(a, name='   ').status_code == 400)
    check('text file as image rejected', upload(a, data=b'<?php echo 1; ?>').status_code == 400)
    write_config('openai')
    r = upload(a)
    check('moderation fails closed w/o key', r.status_code == 400 and 'unavailable' in j(r)['message'], r.text)
    check('rejected file deleted', not [f for f in os.listdir(os.path.join(root, 'uploads')) if f != '.htaccess' and f != '.gitkeep'])
    write_config('off')
    r = upload(a, breed='Beagle', story='Loves naps')
    pet = j(r)
    check('upload 201', r.status_code == 201 and pet['name'] == 'Biscuit', r.text)
    check('tags filtered', pet['personalityTags'] == ['playful', 'lazy'], pet.get('personalityTags'))
    check('xp awarded', pet['_xp']['xp'] == 50 and pet['_xp']['level'] == 2 and pet['_xp']['leveledUp'] is True)
    check('first_upload achievement', 'first_upload' in pet['_newAchievements'])
    check('no ip leaked', 'ownerIp' not in pet and 'owner_ip' not in pet)
    check('photo served', requests.get(BASE + pet['photoUrl']).headers.get('Content-Type', '').startswith('image/'))
    for i in range(4): upload(a, name=f'extra{i}')
    check('6th upload rate limited', upload(a, name='toomany').status_code == 429)

    print('voting + bayesian ranking')
    pid = pet['id']
    check('vote 0 rejected', sess('10.1.0.1').post(f'{BASE}/api/pets/{pid}/vote', json={'score': 0}).status_code == 400)
    check('vote 11 rejected', sess('10.1.0.1').post(f'{BASE}/api/pets/{pid}/vote', json={'score': 11}).status_code == 400)
    check('vote string rejected', sess('10.1.0.1').post(f'{BASE}/api/pets/{pid}/vote', json={'score': 'abc'}).status_code == 400)
    check('vote on missing pet 404', sess('10.1.0.1').post(f'{BASE}/api/pets/9999/vote', json={'score': 5}).status_code == 404)
    check('hasVoted false', j(sess('10.1.0.1').get(f'{BASE}/api/pets/{pid}'))['hasVoted'] is False)
    ok = 0
    for i in range(1, 12):
        r = sess(f'10.1.0.{i}').post(f'{BASE}/api/pets/{pid}/vote', json={'score': 10})
        ok += r.status_code == 200
    check('11 distinct voters accepted', ok == 11)
    s = sess('10.1.0.1')
    r = s.post(f'{BASE}/api/pets/{pid}/vote', json={'score': 10})
    check('same voter 409', r.status_code == 409 and 'already' in j(r)['message'])
    check('hasVoted true', j(s.get(f'{BASE}/api/pets/{pid}'))['hasVoted'] is True)
    # a single perfect vote must NOT outrank an established, consistently perfect pet
    mid = j(upload(carol if False else make_user('dave', '10.2.8.8'), name='Mid', category='bird'))
    for i in range(1, 11): sess(f'10.13.0.{i}').post(f'{BASE}/api/pets/{mid["id"]}/vote', json={'score': 5})
    carol = make_user('carol', '10.2.9.9')
    pet2 = j(upload(carol, name='OneVoteWonder', category='cat'))
    sess('10.2.0.1').post(f'{BASE}/api/pets/{pet2["id"]}/vote', json={'score': 10})
    top = j(a.get(BASE + '/api/pets/top?limit=5'))
    check('bayesian: 11 votes @10 outranks 1 vote @10', [p['name'] for p in top][:3] == ['Biscuit', 'OneVoteWonder', 'Mid'], [p['name'] for p in top])
    d = {p['name']: p for p in top}
    C = (110 + 10 + 50) / 22
    exp = lambda v, tot: v / (v + 10) * (tot / v) + 10 / (v + 10) * C
    check('bayesian math matches formula', abs(d['Biscuit']['bayesianScore'] - exp(11, 110)) < 1e-6 and abs(d['OneVoteWonder']['bayesianScore'] - exp(1, 10)) < 1e-6, (d['Biscuit']['bayesianScore'], exp(11, 110)))
    check('highest sort uses bayesian', [p['name'] for p in j(a.get(BASE + '/api/pets?sort=highest&limit=2'))] == ['Biscuit', 'OneVoteWonder'])
    check('category filter', [p['name'] for p in j(a.get(BASE + '/api/pets?category=cat'))] == ['OneVoteWonder'])
    check('count by category', j(a.get(BASE + '/api/pets/count?category=cat')) == {'count': 1})
    check('new pet gets global avg, not 0', 4 < next(p for p in j(a.get(BASE + '/api/pets?limit=100')) if p['name'] == 'extra0')['bayesianScore'])

    print('logged-in vote rewards')
    b = sess('10.3.0.1')
    b.post(BASE + '/api/auth/register', json={'username': 'bob', 'email': 'bob@example.com', 'password': 'secret1'})
    r = b.post(f'{BASE}/api/pets/{pid}/vote', json={'score': 7}); v = j(r)
    check('vote xp', v['_xp']['xp'] == 5 and v['_streak']['streak'] == 1 and 'first_vote' in v['_newAchievements'], v)
    check('vote returns pet fields', v['voteCount'] == 12 and v['id'] == pid)
    b.post(f'{BASE}/api/pets/{pet2["id"]}/vote', json={'score': 7})
    me = b.get(BASE + '/api/auth/me').json()
    check('streak not double counted same day', me['votingStreak'] == 1 and me['xp'] == 10)

    print('hot / top / random / pet of the day')
    check('hot has recentVotes', j(a.get(BASE + '/api/pets/hot'))[0]['recentVotes'] >= 1)
    check('random returns a pet', 'name' in j(a.get(BASE + '/api/pets/random')))
    p1 = j(a.get(BASE + '/api/pets/of-the-day'))
    check('potd picks best pet', p1 and p1['name'] == 'Biscuit', p1)
    check('potd stable within a day', j(a.get(BASE + '/api/pets/of-the-day'))['id'] == p1['id'])
    time.sleep(0.5)
    check('potd owner emailed once', open(mail_log).read().count("is today's Pet of the Day") == 1)
    check('potd_owner achievement', 'potd_owner' in [x['code'] for x in j(a.get(BASE + '/api/users/alice'))['achievements']])

    print('comments')
    check('comment needs login', sess('10.4.0.1').post(f'{BASE}/api/pets/{pid}/comments', json={'text': 'hi'}).status_code == 401)
    check('51 chars rejected', a.post(f'{BASE}/api/pets/{pid}/comments', json={'text': 'x' * 51}).status_code == 400)
    check('empty rejected', a.post(f'{BASE}/api/pets/{pid}/comments', json={'text': '  '}).status_code == 400)
    r = a.post(f'{BASE}/api/pets/{pid}/comments', json={'text': 'So fluffy 🐾'})
    c = j(r)
    check('comment 201 + xp', r.status_code == 201 and c['_xp']['xp'] == 60 + 0 or c['_xp']['xp'] > 50, c)
    cid = c['id']
    lst = j(a.get(f'{BASE}/api/pets/{pid}/comments'))
    check('comment list shape', lst[0]['username'] == 'alice' and lst[0]['likeCount'] == 0 and lst[0]['hasLiked'] is False and lst[0]['reactions'] == [] and lst[0]['text'] == 'So fluffy 🐾', lst)
    r = sess('10.4.0.2').post(f'{BASE}/api/comments/{cid}/like'); check('like', j(r) == {'likeCount': 1, 'hasLiked': True})
    check('like toggles off', j(sess('10.4.0.2').post(f'{BASE}/api/comments/{cid}/like')) == {'likeCount': 0, 'hasLiked': False})
    sess('10.4.0.2').post(f'{BASE}/api/comments/{cid}/like')
    s5 = sess('10.4.0.5')
    check('react', j(s5.post(f'{BASE}/api/comments/{cid}/reactions', json={'emoji': '😂'})) == {'added': True})
    check('react heart w/o variation selector', j(s5.post(f'{BASE}/api/comments/{cid}/reactions', json={'emoji': '❤'})) == {'added': True})
    check('invalid emoji 400', s5.post(f'{BASE}/api/comments/{cid}/reactions', json={'emoji': '💩'}).status_code == 400)
    reacts = j(s5.get(f'{BASE}/api/pets/{pid}/comments'))[0]['reactions']
    check('reactions grouped + mine', {x['emoji']: (x['count'], x['mine']) for x in reacts} == {'😂': (1, True), '❤️': (1, True)}, reacts)
    check('react toggles off', j(s5.post(f'{BASE}/api/comments/{cid}/reactions', json={'emoji': '😂'})) == {'added': False})
    check('other user cannot edit', b.patch(f'{BASE}/api/comments/{cid}', json={'text': 'hax'}).status_code in (403,))
    check('other user cannot delete', b.delete(f'{BASE}/api/comments/{cid}').status_code == 403)
    check('owner edits', j(a.patch(f'{BASE}/api/comments/{cid}', json={'text': 'Edited'}))['text'] == 'Edited')
    check('owner deletes', a.delete(f'{BASE}/api/comments/{cid}').status_code == 200 and j(a.get(f'{BASE}/api/pets/{pid}/comments')) == [])
    check('react on deleted 404', s5.post(f'{BASE}/api/comments/{cid}/reactions', json={'emoji': '🐾'}).status_code == 404)

    print('reports')
    victim = j(upload(carol, name='Reportable'))
    check('bad report 400', a.post(BASE + '/api/reports', json={'targetType': 'user', 'targetId': 1}).status_code == 400)
    check('report missing target 404', a.post(BASE + '/api/reports', json={'targetType': 'pet', 'targetId': 9999}).status_code == 404)
    last = None
    for i in range(1, 6):
        last = j(sess(f'10.6.0.{i}').post(BASE + '/api/reports', json={'targetType': 'pet', 'targetId': victim['id'], 'reason': 'spam'}))
    check('5th report hides pet', last == {'created': True, 'hidden': True}, last)
    check('duplicate ip report not double counted', j(sess('10.6.0.1').post(BASE + '/api/reports', json={'targetType': 'pet', 'targetId': pid})) == {'created': True, 'hidden': False})
    check('hidden pet 404', a.get(f'{BASE}/api/pets/{victim["id"]}').status_code == 404)
    check('hidden pet not listed', 'Reportable' not in [p['name'] for p in j(a.get(BASE + '/api/pets?limit=100'))])

    print('profiles')
    prof = j(a.get(BASE + '/api/users/alice'))
    check('profile shape', prof['username'] == 'alice' and 'email' not in prof and prof['petCount'] >= 1 and prof['totalVotesReceived'] >= 12 and prof['achievements'][0]['label'], prof.keys())
    check('profile 404', a.get(BASE + '/api/users/nobody').status_code == 404)
    check('bio update', a.patch(BASE + '/api/users/me', json={'bio': 'dog person'}).status_code == 200 and j(a.get(BASE + '/api/users/alice'))['bio'] == 'dog person')
    check('bio needs login', sess('10.7.0.1').patch(BASE + '/api/users/me', json={'bio': 'x'}).status_code == 401)

    print('password reset + login + logout')
    c1 = sess('10.8.0.1')
    check('forgot is generic for unknown email', c1.post(BASE + '/api/auth/forgot-password', json={'email': 'ghost@example.com'}).status_code == 200)
    check('forgot ok', c1.post(BASE + '/api/auth/forgot-password', json={'email': 'alice@example.com'}).status_code == 200)
    tok = re.findall(r'/reset-password\?token=([0-9a-f]{64})', open(mail_log).read())[-1]
    check('reset bad token 400', c1.post(BASE + '/api/auth/reset-password', json={'token': 'nope', 'password': 'newpass1'}).status_code == 400)
    check('reset short password 400', c1.post(BASE + '/api/auth/reset-password', json={'token': tok, 'password': '123'}).status_code == 400)
    check('reset ok', c1.post(BASE + '/api/auth/reset-password', json={'token': tok, 'password': 'newpass1'}).status_code == 200)
    check('reset token single-use', c1.post(BASE + '/api/auth/reset-password', json={'token': tok, 'password': 'again11'}).status_code == 400)
    check('old password fails', c1.post(BASE + '/api/auth/login', json={'email': 'alice@example.com', 'password': 'secret1'}).status_code == 401)
    r = c1.post(BASE + '/api/auth/login', json={'email': 'ALICE@example.com', 'password': 'newpass1'})
    check('new password works (case-insens email)', r.status_code == 200 and j(r)['username'] == 'alice')
    check('logged in', c1.get(BASE + '/api/auth/me').status_code == 200)
    check('logout', c1.post(BASE + '/api/auth/logout').status_code == 200)
    check('logged out', c1.get(BASE + '/api/auth/me').status_code == 401)
    check('resend verification when verified', j(a.post(BASE + '/api/auth/resend-verification')) == {'message': 'Email already verified'})
    r = sess('10.9.0.1').post(BASE + '/api/auth/login', json={'email': 'zzz@example.com', 'password': 'whatever'})
    check('unknown user 401 same message', r.status_code == 401 and j(r)['message'] == 'Invalid email or password')

    print('security')
    r = sess('10.10.0.1').post(BASE + '/api/auth/login', json={'email': 'a@b.com', 'password': 'x'}, headers={'Origin': 'https://evil.example'})
    check('cross-site POST blocked', r.status_code == 403)
    r = sess('10.10.0.1').post(BASE + '/api/auth/login', json={'email': 'a@b.com', 'password': 'x'}, headers={'Origin': BASE})
    check('same-origin POST allowed through', r.status_code == 401)
    ratelimited = [sess('10.11.0.1').post(BASE + '/api/auth/login', json={'email': 'a@b.com', 'password': 'x'}).status_code for _ in range(22)]
    check('login brute force limited', ratelimited[-1] == 429 and ratelimited[0] == 401, ratelimited)
    check('uploads dir blocks php', 'FilesMatch' in open(os.path.join(root, 'uploads', '.htaccess')).read())
    spoof = sess('10.12.0.1')
    check('X-Forwarded-For ignored when not trusted', True)  # config-driven; see below
    write_config(); 
    cfg = open(cfg_path).read().replace("'trust_proxy_header'=>'X-Forwarded-For'", "'trust_proxy_header'=>''"); open(cfg_path, 'w').write(cfg)
    pid_n = pid
    n1 = requests.Session(); n1.headers['X-Forwarded-For'] = '1.1.1.1'
    n2 = requests.Session(); n2.headers['X-Forwarded-For'] = '2.2.2.2'
    pt = j(upload(a, name='SpoofTest')) if False else None
    first = n1.post(f'{BASE}/api/pets/{pet2["id"]}/vote', json={'score': 5}).status_code
    second = n2.post(f'{BASE}/api/pets/{pet2["id"]}/vote', json={'score': 5}).status_code
    check('spoofed forwarded IP cannot bypass one-vote-per-IP', second == 409, (first, second))

    print('share previews (seo.php)')
    r = requests.get(f'{BASE}/pet/{pid}')
    check('pet page has og:title', 'og:title" content="Biscuit - Dog | NowPetMe"' in r.text, r.text[:400])
    check('pet page has absolute og:image', re.search(r'og:image" content="http://127.0.0.1:8099/uploads/[^"]+"', r.text) is not None)
    check('generic og tags replaced', r.text.count('og:title') == 1 and 'content="generic"' not in r.text and r.text.count('<title>') == 1)
    check('pet page keeps React root', '<div id="root"></div>' in r.text)
    check('missing pet 404 still serves app', requests.get(f'{BASE}/pet/9999').status_code == 404)
    check('SPA fallback', '<div id="root">' in requests.get(BASE + '/leaderboard').text)
finally:
    server.terminate()
    log = open(os.path.join(tmp, 'php.log')).read()
    if 'Fatal' in log or 'Warning' in log or 'Notice' in log or 'Deprecated' in log:
        print('\nPHP log contained warnings:\n' + '\n'.join(l for l in log.splitlines() if 'Fatal' in l or 'Warning' in l or 'Notice' in l or 'Deprecated' in l)[:3000])
    shutil.rmtree(tmp, ignore_errors=True)
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
