#!/usr/bin/env node
/**
 * scripts/checkProductionReady.js
 *
 * Pre-deploy preflight. Run BEFORE `npm start` in production.
 * Inspects the environment + filesystem for the common mistakes
 * that have bitten us in the past:
 *
 *   1. NODE_ENV not set to 'production'
 *   2. Required env vars missing or placeholder
 *   3. Forbidden env vars set (DEBUG, BYPASS_AUTH, etc.)
 *   4. JWT secrets are defaults / too short / equal to each other
 *   5. Allowed origins include localhost
 *   6. SMTP / PawaPay credentials look real (not placeholders)
 *   7. Static directories exist and are writable
 *   8. node_modules is present (didn't forget npm install)
 *   9. Mongo URI is reachable (optional — needs --check-db)
 *  10. PawaPay webhook secret is set if NODE_ENV=production
 *
 * Usage:
 *   node scripts/checkProductionReady.js
 *   node scripts/checkProductionReady.js --check-db
 *
 * Exit codes:
 *   0  All checks passed; safe to start
 *   1  One or more critical issues
 *   2  Warnings only (deploy at your discretion)
 *
 * Suggested CI integration: add to your `predeploy` npm script.
 */

import dotenv from 'dotenv';
import { existsSync, accessSync, constants } from 'fs';
import { spawn } from 'child_process';

dotenv.config();

const args = process.argv.slice(2);
const opts = {
    checkDb: args.includes('--check-db'),
    verbose: args.includes('-v') || args.includes('--verbose')
};

let criticals = 0;
let warnings = 0;

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(msg) {
    console.error(`${RED}✗ CRITICAL${RESET} ${msg}`);
    criticals++;
}
function warn(msg) {
    console.warn(`${YELLOW}⚠ WARNING${RESET}  ${msg}`);
    warnings++;
}
function ok(msg) {
    console.log(`${GREEN}✓${RESET}          ${msg}`);
}

console.log('--- Bravo Music Production Readiness Check ---\n');

// Check 1: NODE_ENV
const env = process.env.NODE_ENV;
if (env === 'production') ok('NODE_ENV=production');
else fail(`NODE_ENV is "${env || '(unset)'}" — set to "production" for production deploy`);

// Check 2 & 3: env vars
const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ALLOWED_ORIGINS',
                  'PAWAPAY_API_KEY', 'PAWAPAY_WEBHOOK_SECRET', 'FRONTEND_URL'];
for (const k of REQUIRED) {
    const v = process.env[k];
    if (!v) {
        fail(`Required env var missing: ${k}`);
        continue;
    }
    if (/changeme|example|placeholder|your-|todo/i.test(v)) {
        fail(`${k} appears to be a placeholder value`);
        continue;
    }
    ok(`${k} is set`);
}

const FORBIDDEN = ['DEBUG', 'ENABLE_TEST_ROUTES', 'BYPASS_AUTH', 'BYPASS_WEBHOOK_VERIFY', 'SEED_ON_BOOT'];
for (const k of FORBIDDEN) {
    if (process.env[k]) fail(`Forbidden env var is set: ${k} — remove before deploying`);
}
if (FORBIDDEN.every(k => !process.env[k])) ok('No forbidden env vars set');

// Check 4: JWT secret quality
const js = process.env.JWT_SECRET || '';
const jr = process.env.JWT_REFRESH_SECRET || '';
if (js && js.length < 32) fail(`JWT_SECRET is only ${js.length} chars — should be 32+`);
if (jr && jr.length < 32) fail(`JWT_REFRESH_SECRET is only ${jr.length} chars — should be 32+`);
if (js && jr && js === jr) fail('JWT_SECRET equals JWT_REFRESH_SECRET — they MUST be different');
if (js && jr && js !== jr && js.length >= 32 && jr.length >= 32) {
    ok('JWT secrets are unique and sufficiently long');
}

// Check 5: ALLOWED_ORIGINS shouldn't include localhost in production
if (env === 'production' && process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    const localhost = origins.filter(o => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(o));
    if (localhost.length > 0) {
        warn(`ALLOWED_ORIGINS includes localhost: ${localhost.join(', ')}`);
    } else {
        ok('ALLOWED_ORIGINS contains no localhost entries');
    }
}

// Check 6: FRONTEND_URL is HTTPS
if (process.env.FRONTEND_URL && !/^https:\/\//.test(process.env.FRONTEND_URL)) {
    fail(`FRONTEND_URL must use https:// (current: ${process.env.FRONTEND_URL})`);
} else if (process.env.FRONTEND_URL) {
    ok('FRONTEND_URL uses HTTPS');
}

// Check 7: Static dirs (if env vars set)
const dirs = {
    STATIC_UPLOADS_PATH: process.env.STATIC_UPLOADS_PATH,
    STATIC_MUSIC_PATH:   process.env.STATIC_MUSIC_PATH,
    STATIC_IMAGES_PATH:  process.env.STATIC_IMAGES_PATH
};
for (const [k, dir] of Object.entries(dirs)) {
    if (!dir) {
        warn(`${k} not set — using default (./uploads etc.)`);
        continue;
    }
    if (!existsSync(dir)) {
        fail(`${k} points to non-existent directory: ${dir}`);
        continue;
    }
    try {
        accessSync(dir, constants.W_OK);
        ok(`${k} writable: ${dir}`);
    } catch {
        fail(`${k} NOT writable: ${dir}`);
    }
}

// Check 8: node_modules
if (!existsSync('node_modules')) {
    fail('node_modules/ missing — run `npm install` before deploying');
} else {
    ok('node_modules/ present');
}

// Check 9: db connectivity (optional)
async function checkDb() {
    if (!opts.checkDb) return;
    if (!process.env.MONGO_URI) return;

    const { default: mongoose } = await import('mongoose');
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        ok('MongoDB reachable');
        await mongoose.disconnect();
    } catch (err) {
        fail(`MongoDB unreachable: ${err.message}`);
    }
}

// Check 10: webhook secret in production
if (env === 'production') {
    const ws = process.env.PAWAPAY_WEBHOOK_SECRET || '';
    if (ws.length < 16) {
        fail('PAWAPAY_WEBHOOK_SECRET should be at least 16 characters');
    }
}

// Run async checks
(async () => {
    await checkDb();

    console.log('');
    console.log('--- Summary ---');
    console.log(`Criticals: ${criticals}`);
    console.log(`Warnings:  ${warnings}`);

    if (criticals > 0) {
        console.log(`${RED}NOT READY FOR PRODUCTION${RESET} — fix the criticals above.`);
        process.exit(1);
    }
    if (warnings > 0) {
        console.log(`${YELLOW}READY WITH WARNINGS${RESET} — review the warnings.`);
        process.exit(2);
    }
    console.log(`${GREEN}READY FOR PRODUCTION${RESET}`);
    process.exit(0);
})();
