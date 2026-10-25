import 'server-only';
import { parseEnv } from './env-schema';

export { parseEnv, type Env } from './env-schema';

export const env = parseEnv(process.env);
