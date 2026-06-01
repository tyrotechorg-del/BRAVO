import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';

class EmailService {
    constructor() {
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            console.log('✅ SendGrid configured');
        } else {
            console.log('⚠️ SendGrid not configured, using mock mode');
            this.isConfigured = false;
        }
    }

    async sendEmail(to, subject, html, text = null) {
        if (!this.isConfigured) {
            console.log(`📧 [MOCK] Email to ${to}: ${subject}`);
            return { success: true, mock: true };
        }

        const msg = {
            to,
            from: process.env.EMAIL_FROM || 'noreply@bravomusic.com',
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        };

        try {
            await sgMail.send(msg);
            console.log(`📧 Email sent to ${to}`);
            return { success: true };
        } catch (error) {
            console.error('SendGrid error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendWelcomeEmail(email, username) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #6c63ff; color: white; padding: 30px; text-align: center; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .button { background: #6c63ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Bravo Music! 🎵</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${username},</h2>
                        <p>Welcome to Bravo Music, Zambia's premier music platform!</p>
                        <p>Start exploring millions of songs, create playlists, and discover new artists.</p>
                        <a href="${process.env.FRONTEND_URL}/browse" class="button">Start Listening</a>
                        <p style="margin-top: 20px;">Your journey into music starts here!</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Welcome to Bravo Music! 🎵', html);
    }

    async sendPasswordResetEmail(email, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ff6584; color: white; padding: 30px; text-align: center; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .button { background: #ff6584; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Reset Your Password</h1>
                    </div>
                    <div class="content">
                        <p>We received a request to reset your password.</p>
                        <a href="${resetUrl}" class="button">Reset Password</a>
                        <p>This link expires in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Reset Your Password - Bravo Music', html);
    }

    async sendWeeklyDigest(email, username, stats) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                    .stat-box { text-align: center; padding: 15px; background: #f0f0f0; border-radius: 10px; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #6c63ff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Your Weekly Music Digest, ${username}! 🎧</h2>
                    <div class="stats">
                        <div class="stat-box">
                            <div class="stat-number">${stats.minutesListened}</div>
                            <div>Minutes Listened</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.newSongs}</div>
                            <div>New Songs Discovered</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.topGenre}</div>
                            <div>Top Genre</div>
                        </div>
                    </div>
                    <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #6c63ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Full Report</a>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Your Weekly Bravo Music Digest', html);
    }

    async sendPasswordResetEmail(email, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/#reset-password/${token}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ff6584; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; }
                    .button { display: inline-block; padding: 12px 30px; background: #ff6584; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { color: #ff4757; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Reset Your Password</h1>
                    </div>
                    <div class="content">
                        <h2>Hello,</h2>
                        <p>We received a request to reset your password for your Bravo Music account.</p>
                        <a href="${resetUrl}" class="button">Reset Password</a>
                        <p>This link will expire in 1 hour.</p>
                        <p class="warning">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">Bravo Music - Zambia's Premier Music Platform</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await this.sendEmail(email, 'Reset Your Password - Bravo Music', html);
    }

    async sendWithdrawalNotification(email, amount, status, reference) {
        const statusColor = status === 'approved' ? '#4caf50' : '#ff6584';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .status { color: ${statusColor}; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Withdrawal ${status.toUpperCase()}</h2>
                    <p>Amount: <strong>K${amount}</strong></p>
                    <p>Status: <span class="status">${status}</span></p>
                    <p>Reference: ${reference}</p>
                    ${status === 'approved' ? '<p>Funds have been sent to your mobile money account.</p>' : '<p>Contact support for more information.</p>'}
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, `Withdrawal ${status} - Bravo Music`, html);
    }
}

export default new EmailService();