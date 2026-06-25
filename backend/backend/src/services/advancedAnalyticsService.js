import Analytics from '../models/Analytics.js';
import Song from '../models/Song.js';
import User from '../models/User.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

class AdvancedAnalyticsService {
    async getRealTimeListeners(songId = null) {
        const query = { action: 'stream', timestamp: { $gt: new Date(Date.now() - 5 * 60 * 1000) } };
        if (songId) query.song = songId;
        
        const listeners = await Analytics.distinct('user', query);
        return {
            currentListeners: listeners.length,
            uniqueListeners: new Set(listeners).size,
            timestamp: new Date().toISOString()
        };
    }

    async getGeographicHeatmap(startDate, endDate) {
        const data = await Analytics.aggregate([
            { $match: { 
                action: 'stream', 
                timestamp: { $gte: startDate, $lte: endDate },
                'location.country': { $exists: true }
            }},
            { $group: {
                _id: { country: '$location.country', city: '$location.city' },
                streams: { $sum: 1 },
                uniqueListeners: { $addToSet: '$user' }
            }},
            { $project: {
                country: '$_id.country',
                city: '$_id.city',
                streams: 1,
                uniqueListeners: { $size: '$uniqueListeners' },
                coordinates: '$location.coordinates'
            }}
        ]);
        
        return data;
    }

    async getRetentionCohorts() {
        const now = new Date();
        const cohorts = [];
        
        for (let i = 0; i < 12; i++) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            
            const newUsers = await User.countDocuments({
                createdAt: { $gte: monthStart, $lte: monthEnd }
            });
            
            const retainedUsers = await Analytics.aggregate([
                { $match: { 
                    user: { $in: await User.find({ createdAt: { $lte: monthEnd } }).distinct('_id') },
                    timestamp: { $gte: monthEnd, $lte: now }
                }},
                { $group: { _id: '$user' } },
                { $count: 'count' }
            ]);
            
            cohorts.push({
                month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
                newUsers,
                retentionRate: newUsers > 0 ? (retainedUsers[0]?.count / newUsers * 100).toFixed(2) : 0
            });
        }
        
        return cohorts;
    }

    async getSongDropoffPoints(songId) {
        // Analyze where users stop listening
        const streams = await Analytics.find({ 
            song: songId, 
            action: 'stream',
            duration: { $exists: true }
        }).select('duration');
        
        const song = await Song.findById(songId);
        if (!song) return null;
        
        const completionRates = [];
        for (let i = 0; i <= 100; i += 10) {
            const threshold = song.duration * (i / 100);
            const completed = streams.filter(s => s.duration >= threshold).length;
            completionRates.push({
                percentage: i,
                listeners: completed,
                dropoffRate: streams.length > 0 ? (1 - completed / streams.length) * 100 : 0
            });
        }
        
        return {
            songId,
            title: song.title,
            totalStreams: streams.length,
            averageListenDuration: streams.reduce((sum, s) => sum + (s.duration || 0), 0) / streams.length,
            completionRates
        };
    }

    async getABTestResults(testName, variantA, variantB) {
        const results = {
            variantA: {
                impressions: await Analytics.countDocuments({ action: 'view', referrer: testName, metadata: { variant: 'A' } }),
                conversions: await Analytics.countDocuments({ action: 'click', referrer: testName, metadata: { variant: 'A' } }),
                revenue: await Analytics.aggregate([
                    { $match: { action: 'purchase', referrer: testName, 'metadata.variant': 'A' } },
                    { $group: { _id: null, total: { $sum: '$metadata.amount' } } }
                ])
            },
            variantB: {
                impressions: await Analytics.countDocuments({ action: 'view', referrer: testName, metadata: { variant: 'B' } }),
                conversions: await Analytics.countDocuments({ action: 'click', referrer: testName, metadata: { variant: 'B' } }),
                revenue: await Analytics.aggregate([
                    { $match: { action: 'purchase', referrer: testName, 'metadata.variant': 'B' } },
                    { $group: { _id: null, total: { $sum: '$metadata.amount' } } }
                ])
            }
        };
        
        results.variantA.conversionRate = (results.variantA.conversions / results.variantA.impressions * 100).toFixed(2);
        results.variantB.conversionRate = (results.variantB.conversions / results.variantB.impressions * 100).toFixed(2);
        
        return results;
    }

    async exportToPDF(reportData, filename) {
        const doc = new PDFDocument();
        const filePath = path.join(process.cwd(), 'reports', `${filename}.pdf`);
        
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Title
        doc.fontSize(20).text('Bravo Music Analytics Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        
        // Summary
        doc.fontSize(14).text('Summary Statistics');
        doc.fontSize(10);
        doc.text(`Total Streams: ${reportData.totalStreams?.toLocaleString() || 'N/A'}`);
        doc.text(`Active Users: ${reportData.activeUsers?.toLocaleString() || 'N/A'}`);
        doc.text(`Total Revenue: K${reportData.totalRevenue?.toLocaleString() || '0'}`);
        doc.moveDown();
        
        // Top Songs
        if (reportData.topSongs?.length) {
            doc.fontSize(14).text('Top Performing Songs');
            reportData.topSongs.forEach((song, i) => {
                doc.fontSize(10).text(`${i + 1}. ${song.title} - ${song.streams} streams`);
            });
            doc.moveDown();
        }
        
        doc.end();
        
        return new Promise((resolve) => {
            stream.on('finish', () => resolve(filePath));
        });
    }

    async exportToExcel(data, sheetName, filename) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);
        
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            worksheet.addRow(headers);
            
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6C63FF' }
            };
            
            data.forEach(row => {
                worksheet.addRow(Object.values(row));
            });
            
            worksheet.columns.forEach(column => {
                column.width = 20;
            });
        }
        
        const filePath = path.join(process.cwd(), 'reports', `${filename}.xlsx`);
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }
}

export default new AdvancedAnalyticsService();