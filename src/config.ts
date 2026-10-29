import 'dotenv/config';
import { z } from 'zod';
export function parseConfig(input: NodeJS.ProcessEnv) {
 const config=z.object({ NODE_ENV:z.enum(['development','test','production']).default('development'), PORT:z.coerce.number().int().min(1).max(65535).default(3002), DATABASE_URL:z.string().url().optional(), DEV_AUTH_ENABLED:z.enum(['true','false']).default('false') }).parse(input);
 if(config.NODE_ENV==='production' && config.DEV_AUTH_ENABLED==='true') throw new Error('Development authentication is forbidden in production');
 return config;
}
