const Agenda = require('agenda');
const Analytics = require('../models/Analytics');
const Artist = require('../models/Artist');
const Song = require('../models/Song');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define('aggregate daily analytics', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Aggregate song streams
    const songStreams = await Analytics.aggregate([
        {
            $match: {
                action: 'stream',
                timestamp: { $gte: yesterday, $lt: today }
            }
        },
        {
            $group: {
                _id: '$song',
                count: { $sum: 1 }
            }
        }
    ]);
    
    for (const stat of songStreams) {
        await Song.findByIdAndUpdate(stat._id, {
            $inc: { playCount: stat.count }
        });
    }
    
    // Aggregate artist monthly listeners (unique users)
    const artistListeners = await Analytics.aggregate([
        {
            $match: {
                action: 'stream',
                timestamp: { $gte: new Date(new Date().setDate(1)) }
            }
        },
        {
            $group: {
                _id: {
                    artist: '$artist',
                    user: '$user'
                }
            }
        },
        {
            $group: {
                _id: '$_id.artist',
                count: { $sum: 1 }
            }
        }
    ]);
    
    for (const stat of artistListeners) {
        if (stat._id) {
            await Artist.findByIdAndUpdate(stat._id, {
                monthlyListeners: stat.count
            });
        }
    }
    
    console.log(`Aggregated analytics: ${songStreams.length} songs updated`);
});

module.exports = agenda;