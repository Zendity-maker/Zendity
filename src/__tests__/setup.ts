import { config } from 'dotenv';

// Carga las variables de entorno para pruebas de integración.
// .env.local tiene la URL directa de Neon (sin channel_binding=require) que
// es compatible con PrismaClient en Node.js y no rompe en cold start.
// .env tiene el pooler URL con channel_binding=require (incompatible con PgBouncer).
config({ path: '.env.local' });
config({ path: '.env', override: false });
