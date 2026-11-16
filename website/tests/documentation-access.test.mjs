import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto, createHash, timingSafeEqual } from 'node:crypto';
function compile(file, modules = {}, extra = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,require:name=>modules[name],crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,Date,process:{env:{}},...extra});
    return exports;
}
const password = 'Test8!xQ';
const access = compile('../src/lib/documentation/access.ts');
test('protect only documentation paths, including nested routes', () => {
    for (const path of ['/docs','/docs/api-reference/shipments','/platform/integrations','/platform/integrations/example']) assert.equal(access.protectedDocumentationPath(path),true);
    for (const path of ['/','/platform','/platform/tracking','/docs-other','/admin']) assert.equal(access.protectedDocumentationPath(path),false);
});
test('return destination cannot leave protected local paths', () => {
    for (const path of ['https://evil.test','//evil.test','/\\evil.test','/docs/../../admin','/admin',null]) assert.equal(access.safeDocumentationDestination(path),'/platform/integrations');
    assert.equal(access.safeDocumentationDestination('/docs/api-reference?q=test'),'/docs/api-reference?q=test');
});
test('unset, empty and weak passwords fail closed', () => {
    for (const value of [undefined,'','123456','spaces in the password','a'.repeat(65)]) {
        assert.equal(compile('../src/lib/documentation/access.ts',{}, {process:{env:{DOCUMENTATION_PASSWORD:value}}}).documentationPassword(),null);
    }
});
test('signed session accepts valid password and rejects tampering, rotation and expiry', async () => {
    const now = Date.now();
    const token = await access.createDocumentationSession(password, now);
    assert.equal(await access.validDocumentationSession(token,password,now),true);
    assert.equal(await access.validDocumentationSession(token,password+'changed',now),false);
    assert.equal(await access.validDocumentationSession(token,null,now),false);
    assert.equal(await access.validDocumentationSession(token,password,now+3600_000),false);
    assert.equal(await access.validDocumentationSession('9999999999.'+token.split('.')[1],password,now),false);
    assert.equal(await access.validDocumentationSession(token.slice(0,-1)+'z',password,now),false);
});
function route(configured = password) {
    const NextResponse = {json(body, options) {return {body,status:options.status,headers:new Headers(options.headers),cookies:{set(...args){this.value=args;}}};}};
    return compile('../src/app/api/documentation/access/route.ts', {'node:crypto':{createHash,timingSafeEqual},'next/server':{NextResponse},'@/lib/documentation/access':{...access,documentationPassword:()=>configured}}, {process:{env:{NODE_ENV:'production'}}});
}
function request(body, origin = 'https://spaces.test') {
    const req = new Request('https://spaces.test/api/documentation/access',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
    req.nextUrl = new URL(req.url); return req;
}
test('unlock sets secure HTTP-only expiring cookie, not the password', async () => {
    const response = await route().POST(request({password,next:'/docs/api-reference'}));
    assert.equal(response.status,200);
    assert.equal(response.body.destination,'/docs/api-reference');
    const [name,value,options] = response.cookies.value;
    assert.equal(name,access.DOCUMENTATION_COOKIE);
    assert.equal(value.includes(password),false);
    assert.equal(options.httpOnly,true); assert.equal(options.secure,true); assert.equal(options.sameSite,'strict'); assert.equal(options.maxAge,3600);
    assert.equal(response.headers.get('cache-control'),'no-store');
});
test('wrong password, foreign origin and missing configuration never grant access', async () => {
    assert.equal((await route().POST(request({password:'wrong'}))).status,401);
    assert.equal((await route().POST(request({password},'https://evil.test'))).status,403);
    assert.equal((await route(null).POST(request({password}))).status,503);
});
test('repeated attempts are throttled', async () => {
    const handler = route();
    for(let i=0;i<20;i++) assert.equal((await handler.POST(request({password:'wrong'}))).status,401);
    assert.equal((await handler.POST(request({password}))).status,429);
});
test('oversized input is rejected', async () => {
    assert.equal((await route().POST(request({password:'x'.repeat(5000)}))).status,413);
});
