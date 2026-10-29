import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {parseConfig} from '../src/config.js';
describe('bootstrap security',()=>{
 it('serves health without database',async()=>{expect((await request(createApp(parseConfig({NODE_ENV:'test'}))).get('/health')).status).toBe(200)});
 it('rejects production development auth',()=>{expect(()=>parseConfig({NODE_ENV:'production',DEV_AUTH_ENABLED:'true'})).toThrow()});
 it('ignores forged actor in production',async()=>{expect((await request(createApp(parseConfig({NODE_ENV:'production'}))).get('/api/dev/actor').set('X-Test-Actor','{}')).status).toBe(404)});
 it('rejects malformed actor locally',async()=>{expect((await request(createApp(parseConfig({NODE_ENV:'test',DEV_AUTH_ENABLED:'true'}))).get('/api/dev/actor').set('X-Test-Actor','{}')).status).toBe(401)});
 it('accepts explicit local fixture',async()=>{expect((await request(createApp(parseConfig({NODE_ENV:'test',DEV_AUTH_ENABLED:'true'}))).get('/api/dev/actor').set('X-Test-Actor',JSON.stringify({user_id:'11111111-1111-4111-8111-111111111111',role:'staff'}))).status).toBe(200)});
});
