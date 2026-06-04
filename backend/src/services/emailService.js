import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
    constructor() {
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            this.fromEmail = process.env.EMAIL_FROM || 'noreply@bravomusics.com';
            console.log('✅ SendGrid configured successfully');
        } else {
            console.log('⚠️ SendGrid not configured - API key missing or invalid');
            console.log('📧 Email sending will run in MOCK mode (console only)');
            this.isConfigured = false;
            this.fromEmail = process.env.EMAIL_FROM || 'noreply@bravomusics.com';
        }
    }

    async sendEmail(to, subject, html, text = null) {
        if (!this.isConfigured) {
            console.log(`📧 [MOCK MODE] Email would be sent to: ${to}`);
            console.log(`   Subject: ${subject}`);
            console.log(`   Preview: ${html.substring(0, 200)}...`);
            return { success: true, mock: true, message: 'Mock email sent (configure SendGrid for production)' };
        }

        const msg = {
            to,
            from: {
                email: this.fromEmail,
                name: 'Bravo Music'
            },
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '').substring(0, 500)
        };

        try {
            const response = await sgMail.send(msg);
            console.log(`✅ Email sent successfully to ${to} - Subject: ${subject}`);
            return { success: true, response };
        } catch (error) {
            console.error('❌ SendGrid error:', error.response?.body || error.message);
            return { success: false, error: error.message };
        }
    }

    async sendVerificationEmail(email, token, username) {
        const verificationUrl = `${process.env.FRONTEND_URL || 'https://bravomusics.com'}/#verify-email/${token}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #6c63ff, #8b44c8); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; }
                    .button { display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #6c63ff, #8b44c8); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; margin: 20px 0; }
                    .button:hover { opacity: 0.9; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
                    .warning { color: #ff9800; font-size: 12px; margin-top: 20px; }
                    .logo { font-size: 24px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 Bravo Music</div>
                        <h1>Verify Your Email Address</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${username || 'there'}!</h2>
                        <p>Thank you for registering as an artist on <strong>Bravo Music</strong> - Zambia's Premier Music Platform!</p>
                        <p>Please verify your email address to start uploading your music and reaching fans across Zambia.</p>
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="button">Verify Email Address</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
                        <p class="warning">⚠️ This verification link will expire in 24 hours.</p>
                        <hr>
                        <p style="font-size: 14px;">After verification, you'll be able to:</p>
                        <ul style="font-size: 14px;">
                            <li>Upload your music and videos</li>
                            <li>Earn royalties from streams</li>
                            <li>Connect with your fans</li>
                            <li>Access artist analytics dashboard</li>
                        </ul>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Bravo Music. All rights reserved.</p>
                        <p>Zambia's Premier Music Platform</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(email, 'Verify Your Email - Bravo Music Artist Registration', html);
    }

    async sendWelcomeEmail(email, username) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #6c63ff, #8b44c8); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; }
                    .button { display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #6c63ff, #8b44c8); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; margin: 20px 0; }
                    .feature-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Bravo Music! 🎵</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${username},</h2>
                        <p>Welcome to Bravo Music, Zambia's premier music platform! Your email has been successfully verified.</p>
                        
                        <div class="feature-box">
                            <h3>✨ Getting Started as an Artist:</h3>
                            <ol>
                                <li>Upload your first song or music video</li>
                                <li>Complete your artist profile</li>
                                <li>Choose a subscription plan to start earning</li>
                                <li>Share your music with fans</li>
                            </ol>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.FRONTEND_URL || 'https://bravomusics.com'}/#dashboard" class="button">Go to Your Dashboard</a>
                        </div>
                        
                        <p>Need help? Contact our support team at support@bravomusics.com</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Bravo Music. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Welcome to Bravo Music! 🎵', html);
    }

    async sendPasswordResetEmail(email, token, username) {
        const resetUrl = `${process.env.FRONTEND_URL || 'https://bravomusics.com'}/#reset-password/${token}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #ff6584, #ff4757); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; }
                    .button { display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #ff6584, #ff4757); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; margin: 20px 0; }
                    .warning { color: #ff4757; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Reset Your Password</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${username || 'there'},</h2>
                        <p>We received a request to reset your password for your Bravo Music account.</p>
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link: ${resetUrl}</p>
                        <p class="warning">⚠️ This link will expire in 1 hour for security reasons.</p>
                        <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">Bravo Music - Zambia's Premier Music Platform</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(email, 'Reset Your Password - Bravo Music', html);
    }

    async sendPasswordChangeConfirmation(email, username) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #4caf50, #45a049); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; }
                    .checkmark { font-size: 60px; text-align: center; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Changed Successfully</h1>
                    </div>
                    <div class="content">
                        <div class="checkmark">✓</div>
                        <h2>Hello ${username || 'there'},</h2>
                        <p>Your Bravo Music account password has been changed successfully.</p>
                        <p>If you did not make this change, please contact our support team immediately at support@bravomusics.com</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">Bravo Music - Zambia's Premier Music Platform</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Your Password Has Been Changed - Bravo Music', html);
    }

    async sendWeeklyDigest(email, username, stats) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                    .stat-box { text-align: center; padding: 15px; background: #f0f0f0; border-radius: 10px; flex: 1; margin: 0 5px; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #6c63ff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Your Weekly Music Digest, ${username}! 🎧</h2>
                    <div class="stats">
                        <div class="stat-box">
                            <div class="stat-number">${stats.minutesListened || 0}</div>
                            <div>Minutes Listened</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.newSongs || 0}</div>
                            <div>New Songs Discovered</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-number">${stats.topGenre || 'Various'}</div>
                            <div>Top Genre</div>
                        </div>
                    </div>
                    <a href="${process.env.FRONTEND_URL || 'https://bravomusics.com'}/#dashboard" style="display: inline-block; background: #6c63ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Full Report</a>
                </div>
            </body>
            </html>
        `;
        return this.sendEmail(email, 'Your Weekly Bravo Music Digest', html);
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