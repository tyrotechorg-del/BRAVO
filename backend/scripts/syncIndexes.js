/**
 * scripts/syncIndexes.js
 *
 * Runs `Model.syncIndexes()` on every registered Mongoose model.
 * This applies index definitions from the schemas to the actual
 * MongoDB collections — including dropping indexes that no
 * longer exist in the model.
 *
 * When to run:
 *   - After deploying any batch that adds/changes a schema index
 *     (notably batch 6, which redid the Like, Song, Album, and
 *     Artist indexes)
 *   - Once per deploy as part of the runbook
 *   - When index hints in slow queries suggest the indexes are
 *     missing from the cluster
 *
 * Usage:
 *   node scripts/syncIndexes.js [--dry-run] [--mongo-uri <uri>]
 *
 * Options:
 *   --dry-run         Show what would change; don't apply
 *   --mongo-uri <uri> Override MONGO_URI env var
 *
 * IMPORTANT:
 *   syncIndexes() DROPS indexes that exist on the collection but
 *   are NOT in the schema. If you've manually created indexes in
 *   the Mongo shell, they'll be removed. Take a backup first.
 *
 * Exit codes:
 *   0  Success
 *   1  Connection or operation failure
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { readdirSync } from 'fs';

dotenv.config();

const args = process.argv.slice(2);
const opts = {
    dryRun: args.includes('--dry-run'),
    mongoUri: process.env.MONGO_URI
};
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mongo-uri') opts.mongoUri = args[++i];
}

if (!opts.mongoUri) {
    console.error('MONGO_URI is not set. Provide via env or --mongo-uri.');
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the models directory relative to where this script lives.
// Assumes the script is in backend/scripts/ and models in backend/src/models/.
const MODELS_DIR = path.resolve(__dirname, '..', 'src', 'models');

async function loadAllModels() {
    let modelFiles;
    try {
        modelFiles = readdirSync(MODELS_DIR).filter(f => f.endsWith('.js'));
    } catch (err) {
        console.error(`Could not read models dir at ${MODELS_DIR}: ${err.message}`);
        process.exit(1);
    }

    for (const file of modelFiles) {
        const fullPath = path.join(MODELS_DIR, file);
        try {
            // Dynamic import — registers the model with mongoose
            // when the schema file runs its `mongoose.model(...)` call.
            await import(fullPath);
        } catch (err) {
            console.warn(`[skip] ${file}: ${err.message}`);
        }
    }
}

async function main() {
    console.log('--- Mongoose syncIndexes ---');
    console.log(`Mode:      ${opts.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`);
    console.log(`Mongo URI: ${opts.mongoUri.replace(/\/\/.*@/, '//***@')}`);
    console.log('');

    try {
        await mongoose.connect(opts.mongoUri);
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }

    await loadAllModels();

    const modelNames = Object.keys(mongoose.models);
    console.log(`Loaded ${modelNames.length} models: ${modelNames.join(', ')}`);
    console.log('');

    let totalAdded = 0;
    let totalDropped = 0;
    let totalErrors = 0;

    for (const name of modelNames) {
        const Model = mongoose.models[name];
        try {
            if (opts.dryRun) {
                // Compute the diff without writing.
                const schemaIndexes = Model.schema.indexes();
                const collectionIndexes = await Model.collection.indexes();

                const schemaSpecs = schemaIndexes.map(i => JSON.stringify(i[0]));
                const collectionSpecs = collectionIndexes
                    .filter(i => i.name !== '_id_')   // _id_ is automatic
                    .map(i => JSON.stringify(i.key));

                const toAdd = schemaSpecs.filter(s => !collectionSpecs.includes(s));
                const toDrop = collectionSpecs.filter(s => !schemaSpecs.includes(s));

                if (toAdd.length === 0 && toDrop.length === 0) {
                    console.log(`  ${name}: up to date`);
                } else {
                    console.log(`  ${name}:`);
                    toAdd.forEach(s => console.log(`    + add ${s}`));
                    toDrop.forEach(s => console.log(`    - drop ${s}`));
                    totalAdded += toAdd.length;
                    totalDropped += toDrop.length;
                }
            } else {
                // Actually sync.
                const result = await Model.syncIndexes();
                // syncIndexes returns array of dropped index names.
                if (Array.isArray(result) && result.length > 0) {
                    console.log(`  ${name}: dropped indexes [${result.join(', ')}], synced from schema`);
                    totalDropped += result.length;
                } else {
                    console.log(`  ${name}: synced`);
                }
            }
        } catch (err) {
            console.error(`  ${name}: ERROR — ${err.message}`);
            totalErrors++;
        }
    }

    console.log('');
    console.log('=== Summary ===');
    if (opts.dryRun) {
        console.log(`  Would add:  ${totalAdded}`);
        console.log(`  Would drop: ${totalDropped}`);
        console.log('  (DRY RUN — re-run without --dry-run to apply)');
    } else {
        console.log(`  Indexes synced. ${totalDropped} dropped (no longer in schema).`);
    }
    if (totalErrors > 0) {
        console.log(`  Errors: ${totalErrors}`);
    }

    await mongoose.disconnect();

    if (totalErrors > 0) process.exit(1);
}

main().catch(err => {
    console.error('syncIndexes failed:', err);
    process.exit(1);
});
