import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./auth/passport";
import authRouter from "./routes/auth.routes";
import router from "./routes";
import { SESSION_SECRET } from "./utils/keys";
import pgSession from "connect-pg-simple";
import { setupSwagger } from "./swagger/swaggerConfig";

const app = express();

// CORS FIRST
app.use(
  cors({
    origin: true, // ✅ reflect the request origin (instead of hardcoding)
    credentials: true, // ✅ allow cookies/session to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    store: new (pgSession(session))(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // ✅ set true only in production with HTTPS
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", router);

app.get("/api/v1", (_req, res) => {
  res.status(200).json({ message: "Welcome to QueCode backend!" });
});

export default app;
