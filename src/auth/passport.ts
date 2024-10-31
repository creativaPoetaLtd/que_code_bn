// auth/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { GOOGLE_CLIENT_ID, GOOGLE_SECRET_ID } from '../utils/keys';
import { insert_function, read_function } from '../utils/db_methods';
import { UserModelAttributes } from '../types/model';

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_SECRET_ID,
      callbackURL: '/api/v1/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists in the database
        console.log("profile============================", profile?.emails?.[0].value);
        
        const existingUser = await read_function<UserModelAttributes>(
          'User',
          'findOne',
          { where: { email: profile?.emails?.[0].value } }
        );

        if (existingUser) {
          return done(null, existingUser);
        }

        // If user doesn't exist, create a new one
        const newUser = await insert_function<UserModelAttributes>(
          'User',
          'create',
          {
            googleId: profile.id,
            email: profile.emails?.[0].value || '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            gender: 'Not specified',
            phone: 'Not specified',
            address: 'Not specified',
            password: 'P@ssword',
          }
        );

        done(null, newUser);
      } catch (error) {
        done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await read_function<UserModelAttributes>('User', 'findByPk', id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
