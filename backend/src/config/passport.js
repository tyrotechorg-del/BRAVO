const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// JWT Strategy
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
        const user = await User.findById(payload.userId);
        if (user && user.isActive) {
            return done(null, user);
        }
        return done(null, false);
    } catch (error) {
        return done(error, false);
    }
}));

// Google OAuth Strategy (future ready)
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });
            
            if (!user) {
                user = await User.findOne({ email: profile.emails[0].value });
                
                if (!user) {
                    user = new User({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        username: profile.displayName.toLowerCase().replace(/\s/g, ''),
                        fullName: profile.displayName,
                        isVerified: true
                    });
                    await user.save();
                } else {
                    user.googleId = profile.id;
                    await user.save();
                }
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, false);
        }
    }));
}

module.exports = passport;