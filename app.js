const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv");
const session = require("express-session");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const passport = require("passport");
const nocache = require("nocache");
require("./config/passport");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");

db();

app.use(nocache());
env.config();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

// Sync Passport user with our session-based user and expose to views
app.use((req, res, next) => {
  if (req.user && !req.session.user) {
    req.session.user = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    };
  }
  res.locals.user = req.session.user || null;
  next();
});

app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static(path.join(__dirname, "public")));

app.use("/", userRouter);
app.use("/admin", adminRouter);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
});

module.exports = app;
