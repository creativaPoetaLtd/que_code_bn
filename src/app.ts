// app.ts
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
import * as path from "path";
import FirebaseService from "./services/firebaseService";
import auditLogger from "./middleware/audit.middleware";

const app = express();

// Initialize Firebase
FirebaseService.getInstance().initialize();

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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
  }),
);
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  process.env.ADMIN_FRONTEND_URL,
  process.env.FRONTEND_URL,
  "https://qiew-code-dev2.netlify.app",
  "https://qc-dev2.netlify.app",
].filter(Boolean);
const netlifyPreviewOriginPatterns = [
  /^https:\/\/deploy-preview-\d+--qiew-code-dev2\.netlify\.app$/,
  /^https:\/\/deploy-preview-\d+--qc-dev2\.netlify\.app$/,
];

// CORS configuration - allow credentials with specific origin
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      netlifyPreviewOriginPatterns.some((pattern) => pattern.test(origin))
    ) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "x-qc-device-id",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Middleware
// Apply CORS first to handle preflight requests
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit logging middleware (logs all API requests)
app.use(auditLogger);

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint for deployment monitoring
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes
app.use("/api/v1", router);
app.use("/api/v1/auth", authRouter);
app.get("/api/v1", (_req, res) => {
  res.status(200).json({
    message: "Welcome to QueCode backend!",
  });
});

export default app;
