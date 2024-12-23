// app.ts
import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import passport from "./auth/passport";
import authRouter from "./routes/auth.routes";
import router from "./routes";
import { SESSION_SECRET } from "./utils/keys";

const app = express();

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", router);
app.use("/api/v1/auth", authRouter);
app.get("/api/v1", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to qew code backend!",
  });
});

export default app;
