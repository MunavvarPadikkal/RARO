const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    // If user exists
    if (user) {
      if (user.isBlocked) {
  return done(null, false, { message: "User is blocked by admin" });
        }
      return done(null, user);
    }

    // Check if email already exists
    const existingEmailUser = await User.findOne({ email: profile.emails[0].value });
    if (existingEmailUser) {
        return done(null, false, { message: "User with this email already exists" });
    }

    // If new user
    user = await User.create({
      name: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id,
    });

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});