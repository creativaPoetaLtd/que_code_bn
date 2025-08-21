// app.ts
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./auth/passport";
import authRouter from "./routes/auth.routes";
import router from "./routes";
import { SESSION_SECRET } from "./utils/keys";
import pgSession from "connect-pg-simple";
import { setupSwagger } from "./swagger/swaggerConfig";

const app = express();

// Session configuration
app.use(
  session({
    store: new (pgSession(session))({
      // Connection options
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true },
  })
);

// Middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use("/api/v1", router);
app.use("/api/v1/auth", authRouter);
app.get("/api/v1", (_req, res) => {
  res.status(200).json({
    message: "Welcome to QueCode backend!",
  });
});

export default app;
