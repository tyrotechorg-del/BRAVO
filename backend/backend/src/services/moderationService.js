import Report from '../models/Report.js';
import Comment from '../models/Comment.js';
import Song from '../models/Song.js';
import User from '../models/User.js';

class ModerationService {
    async reportContent(reporterId, type, contentId, reason, description) {
        const report = new Report({
            reporter: reporterId,
            type,
            contentId,
            reason,
            description,
            status: 'pending'
        });
        await report.save();
        return report;
    }
    
    async getPendingReports(type = null) {
        const query = { status: 'pending' };
        if (type) query.type = type;
        
        const reports = await Report.find(query)
            .populate('reporter', 'username email')
            .populate('resolvedBy', 'username')
            .sort({ createdAt: -1 });
        return reports;
    }
    
    async resolveReport(reportId, adminId, action, adminNotes) {
        const report = await Report.findById(reportId);
        if (!report) throw new Error('Report not found');
        
        report.status = 'resolved';
        report.resolvedBy = adminId;
        report.resolvedAt = new Date();
        report.adminNotes = adminNotes;
        
        switch (action) {
            case 'remove_content':
                if (report.type === 'song') {
                    await Song.findByIdAndDelete(report.contentId);
                } else if (report.type === 'comment') {
                    await Comment.findByIdAndDelete(report.contentId);
                }
                report.actionTaken = 'content_removed';
                break;
            case 'warn_user':
                report.actionTaken = 'user_warned';
                break;
            case 'ban_user':
                if (report.reportedUser) {
                    await User.findByIdAndUpdate(report.reportedUser, { isActive: false });
                }
                report.actionTaken = 'user_banned';
                break;
            case 'dismiss':
                report.actionTaken = 'dismissed';
                break;
        }
        
        await report.save();
        return report;
    }
    
    async getModerationStats() {
        const stats = {
            pending: await Report.countDocuments({ status: 'pending' }),
            resolved: await Report.countDocuments({ status: 'resolved' }),
            dismissed: await Report.countDocuments({ status: 'dismissed' })
        };
        return stats;
    }
}

export default new ModerationService();