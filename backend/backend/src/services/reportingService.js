import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportingService {
    constructor() {
        this.reportsDir = path.join(process.cwd(), 'reports');
        this.ensureReportsDir();
    }
    
    ensureReportsDir() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }
    
    async generateRevenueReport(startDate, endDate) {
        const Payment = await import('../models/Payment.js');
        
        const payments = await Payment.default.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, type: '$type' }, total: { $sum: '$amount' }, commission: { $sum: '$platformCommission' }, artistShare: { $sum: '$artistRevenue' }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        return {
            totalRevenue: payments.reduce((sum, p) => sum + p.total, 0),
            totalCommission: payments.reduce((sum, p) => sum + (p.commission || 0), 0),
            totalArtistShare: payments.reduce((sum, p) => sum + (p.artistShare || 0), 0),
            period: { start: startDate, end: endDate },
            details: payments
        };
    }
    
    async generateUserReport() {
        const User = await import('../models/User.js');
        const Artist = await import('../models/Artist.js');
        
        const totalUsers = await User.default.countDocuments();
        const activeUsers = await User.default.countDocuments({ isActive: true });
        const verifiedUsers = await User.default.countDocuments({ isVerified: true });
        
        const usersByRole = await User.default.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
        
        const artists = await Artist.default.find().populate('userId', 'createdAt');
        const newArtistsLast30Days = artists.filter(a => a.userId.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
        
        return {
            totalUsers,
            activeUsers,
            verifiedUsers,
            usersByRole,
            artists: {
                total: artists.length,
                verified: artists.filter(a => a.verified).length,
                featured: artists.filter(a => a.featured).length,
                newLast30Days: newArtistsLast30Days
            }
        };
    }
    
    async generateContentReport() {
        const Song = await import('../models/Song.js');
        const Album = await import('../models/Album.js');
        
        const totalSongs = await Song.default.countDocuments();
        const approvedSongs = await Song.default.countDocuments({ status: 'approved' });
        const pendingSongs = await Song.default.countDocuments({ status: 'pending' });
        
        const songsByGenre = await Song.default.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        const topSongs = await Song.default.find({ status: 'approved' })
            .sort({ playCount: -1 })
            .limit(10)
            .populate('artist', 'stageName');
        
        const totalAlbums = await Album.default.countDocuments({ status: 'published' });
        
        return {
            songs: { total: totalSongs, approved: approvedSongs, pending: pendingSongs, byGenre: songsByGenre, topSongs },
            albums: { total: totalAlbums }
        };
    }
    
    async exportToExcel(data, filename) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Report');
        
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            worksheet.addRow(headers);
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };
            
            data.forEach(row => worksheet.addRow(Object.values(row)));
            worksheet.columns.forEach(column => { column.width = 15; });
        }
        
        const filePath = path.join(this.reportsDir, `${filename}.xlsx`);
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }
    
    async exportToPDF(html, filename) {
        const doc = new PDFDocument();
        const filePath = path.join(this.reportsDir, `${filename}.pdf`);
        const stream = fs.createWriteStream(filePath);
        
        doc.pipe(stream);
        doc.fontSize(16).text('Bravo Music Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(html, { align: 'left' });
        doc.end();
        
        return new Promise((resolve) => {
            stream.on('finish', () => resolve(filePath));
        });
    }
}

export default new ReportingService();