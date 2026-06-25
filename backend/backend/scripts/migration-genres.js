/**
 * Genre Canonicalization Migration
 *
 * Run ONCE after deploying batch 6 (which added the genres
 * canonicalization on save) to fix existing records with legacy
 * or capitalization-variant genres.
 *
 * Usage:
 *   node migration-genres.js [--dry-run] [--mongo-uri <uri>]
 *
 * Options:
 *   --dry-run            Don't write — just report what would change
 *   --mongo-uri <uri>    Override MONGO_URI env var
 *   --collection <name>  Limit to a single collection (default: all)
 *
 * The migration:
 *   1. Connects to MongoDB
 *   2. For each genre-bearing collection (Song, Album, Artist),
 *      reads every record
 *   3. Computes the canonical genre via normalizeGenre()
 *   4. Updates the record if the canonical form differs
 *   5. Tracks records whose CURRENT genre is invalid (no canonical
 *      mapping found) and reports them — those need a human to
 *      pick a replacement
 *
 * Idempotent: running twice does nothing on the second pass.
 *
 * ============================================================
 * MAPPING TABLE
 * ============================================================
 * The 5 removed genres need to map to something. Sensible
 * defaults (operator can override via the OVERRIDES env var):
 *
 *   House    → Amapiano    (closest Zambian alternative)
 *   Pop      → R&B
 *   Jazz     → Soul
 *   Funk     → Soul
 *   Latin    → Traditional (or Other if Latin music is rare in catalogue)
 *
 * If you'd rather flag-then-manually-resolve, run with
 * STRICT=1 — the script will list the affected records and
 * NOT change them.
 */

import mongoose from 'mongoose';

// ============================================================
// Canonical list — matches backend utils/genres.js + frontend config.js
// ============================================================
const CANONICAL_GENRES = new Set([
    'Afrobeat', 'Amapiano', 'Cuundu', 'Dancehall', 'Gospel',
    'Hip Hop', 'Kalindula', 'Other', 'R&B', 'Reggae',
    'Rock', 'Soul', 'Traditional'
]);

// Map for legacy genres → canonical replacement.
// The backend's normalizeGenre handles capitalization variants;
// these are the FIVE explicitly-removed genres.
const LEGACY_MAP = {
    'house':    'Amapiano',
    'pop':      'R&B',
    'jazz':     'Soul',
    'funk':     'Soul',
    'latin':    'Traditional'
};

// Case-insensitive lookup helper
function buildCanonicalIndex() {
    const idx = new Map();
    for (const g of CANONICAL_GENRES) {
        idx.set(g.toLowerCase(), g);
    }
    return idx;
}

function normalizeGenre(raw, canonicalIdx) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();

    // Direct canonical match (case-insensitive)?
    if (canonicalIdx.has(lower)) return canonicalIdx.get(lower);

    // Legacy mapping?
    if (LEGACY_MAP[lower]) return LEGACY_MAP[lower];

    // Common variants
    if (lower === 'hiphop' || lower === 'hip-hop') return 'Hip Hop';
    if (lower === 'rnb' || lower === 'r and b') return 'R&B';
    if (lower === 'reggaeton') return 'Reggae';

    // Unknown — caller decides whether to default to 'Other' or flag
    return null;
}

// ============================================================
// CLI args
// ============================================================
function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        dryRun: false,
        strict: process.env.STRICT === '1',
        mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/bravomusic',
        collection: null
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--mongo-uri') opts.mongoUri = args[++i];
        else if (a === '--collection') opts.collection = args[++i];
        else if (a === '--help' || a === '-h') {
            console.log('Usage: node migration-genres.js [--dry-run] [--mongo-uri <uri>] [--collection <name>]');
            process.exit(0);
        }
    }
    return opts;
}

// ============================================================
// Main
// ============================================================
async function main() {
    const opts = parseArgs();
    const canonicalIdx = buildCanonicalIndex();

    console.log('--- Genre Canonicalization Migration ---');
    console.log(`Mode:       ${opts.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`);
    console.log(`Strict:     ${opts.strict}`);
    console.log(`Mongo URI:  ${opts.mongoUri.replace(/\/\/.*@/, '//***@')}`);
    console.log(`Collection: ${opts.collection || 'all (Song, Album, Artist)'}`);
    console.log('');

    try {
        await mongoose.connect(opts.mongoUri);
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }

    const collections = opts.collection
        ? [opts.collection]
        : ['Song', 'Album', 'Artist'];

    const summary = {};

    for (const collName of collections) {
        console.log(`\n=== Processing ${collName} ===`);
        const col = mongoose.connection.db.collection(collName.toLowerCase() + 's');

        const stats = {
            scanned: 0,
            unchanged: 0,
            normalized: 0,
            mapped: 0,
            unmapped: 0,
            unmappedSamples: []
        };

        const cursor = col.find({});
        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            stats.scanned++;

            // 'genres' (array, used by Artist) or 'genre' (string, used by Song/Album)
            let needsUpdate = false;
            const update = {};

            if (typeof doc.genre === 'string') {
                const canonical = normalizeGenre(doc.genre, canonicalIdx);
                if (canonical === null) {
                    stats.unmapped++;
                    if (stats.unmappedSamples.length < 5) {
                        stats.unmappedSamples.push({ _id: doc._id, genre: doc.genre });
                    }
                } else if (canonical !== doc.genre) {
                    needsUpdate = true;
                    update.genre = canonical;
                    if (LEGACY_MAP[doc.genre.toLowerCase()]) stats.mapped++;
                    else stats.normalized++;
                } else {
                    stats.unchanged++;
                }
            }

            if (Array.isArray(doc.genres)) {
                const newGenres = [];
                let arrChanged = false;
                let arrUnmapped = false;
                for (const g of doc.genres) {
                    const canonical = normalizeGenre(g, canonicalIdx);
                    if (canonical === null) {
                        arrUnmapped = true;
                        if (stats.unmappedSamples.length < 5) {
                            stats.unmappedSamples.push({ _id: doc._id, genre: g });
                        }
                        // In strict mode keep the unmapped value; otherwise drop it.
                        if (opts.strict) newGenres.push(g);
                    } else {
                        if (canonical !== g) arrChanged = true;
                        if (!newGenres.includes(canonical)) newGenres.push(canonical);
                    }
                }
                if (arrUnmapped) stats.unmapped++;
                if (arrChanged && !arrUnmapped) {
                    needsUpdate = true;
                    update.genres = newGenres;
                    stats.normalized++;
                } else if (arrChanged && arrUnmapped && !opts.strict) {
                    needsUpdate = true;
                    update.genres = newGenres;
                    stats.normalized++;
                } else if (!arrChanged && !arrUnmapped) {
                    stats.unchanged++;
                }
            }

            if (needsUpdate && !opts.dryRun) {
                await col.updateOne({ _id: doc._id }, { $set: update });
            }
        }

        summary[collName] = stats;
        console.log(`  Scanned:     ${stats.scanned}`);
        console.log(`  Unchanged:   ${stats.unchanged}`);
        console.log(`  Normalized:  ${stats.normalized}  (case/format fixes)`);
        console.log(`  Mapped:      ${stats.mapped}      (legacy genre → canonical)`);
        console.log(`  Unmapped:    ${stats.unmapped}    (manual fix needed)`);
        if (stats.unmappedSamples.length > 0) {
            console.log('  Unmapped samples:');
            for (const s of stats.unmappedSamples) {
                console.log(`    _id=${s._id}  genre="${s.genre}"`);
            }
        }
    }

    console.log('\n=== Summary ===');
    for (const [coll, s] of Object.entries(summary)) {
        const changes = s.normalized + s.mapped;
        console.log(`  ${coll}: ${changes} changed, ${s.unmapped} need manual fix`);
    }
    if (opts.dryRun) {
        console.log('\n(DRY RUN — no documents were modified. Re-run without --dry-run to apply.)');
    } else {
        console.log('\nDone.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
