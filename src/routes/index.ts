import express from "express";
import orgRouter from "./organization.routes";
const router = express.Router();
router.use("/organizations", orgRouter);
export default router;