const Agenda = require('agenda');
const royaltyService = require('../services/royaltyService');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define('calculate monthly royalties', async () => {
    console.log('Starting monthly royalty calculation...');
    
    try {
        const results = await royaltyService.processMonthlyRoyalties();
        
        console.log(`Royalties calculated for ${results.length} songs`);
        console.log(`Total distributed: K${results.reduce((sum, r) => sum + r.royalties.artistShare, 0)}`);
        
        // Log results
        const fs = require('fs');
        const report = {
            date: new Date(),
            totalSongs: results.length,
            totalDistributed: results.reduce((sum, r) => sum + r.royalties.artistShare, 0),
            details: results
        };
        
        fs.writeFileSync(
            `logs/royalty-report-${Date.now()}.json`,
            JSON.stringify(report, null, 2)
        );
    } catch (error) {
        console.error('Royalty calculation failed:', error);
    }
});

module.exports = agenda;