import 'dotenv/config';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
const url=process.env.DATABASE_URL;
if(!url) throw Error('DATABASE_URL required');
const target=new URL(url);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.pathname!=='/caregap_local') throw Error('Runner restricted to caregap_local on loopback; shared DB migrations require team review');
const db=new pg.Client({connectionString:url});
await db.connect();
try {
 await db.query('SELECT pg_advisory_lock(3002001)');
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) {
  const sql=await readFile(new URL(file,dir),'utf8'); const hash=createHash('sha256').update(sql).digest('hex');
  const existing=await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[file]);
  if(existing.rowCount) {if(existing.rows[0].checksum!==hash) throw Error('Applied migration changed: '+file); continue;}
  await db.query('BEGIN');
  try {await db.query(sql); await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[file,hash]); await db.query('COMMIT');}
  catch(error){await db.query('ROLLBACK');throw error;}
 }
} finally {await db.end();}
