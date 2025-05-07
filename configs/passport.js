const passport=require('passport');
const googlestragy=require('passport-google-oauth20').Strategy;
const User=require('../models/user');

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
User.findById(id)
.then(user=>{
    done(null,user)
}).catch(err=>{
    done(err)
})
})

passport.use(new googlestragy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback',
    scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.events.owned'
    ],
    accessType: 'offline',
    prompt: 'consent'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            user.tokens = {
                access_token: accessToken,
                refresh_token: refreshToken
            };
            await user.save();
            return done(null, user);
        }

        const newUser = await new User({
            googleId: profile.id,
            name: `${profile.name.givenName} ${profile.name.familyName}`,
            email: profile.emails[0].value,
            isVerified: true,
            isOnline: true,
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken
            }
        }).save();

        done(null, newUser);
    } catch (err) {
        done(err);
    }
  }
));

