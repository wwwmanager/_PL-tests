import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { getMe } from "../controllers/meController";

export const router = Router();

// REL-001: /me endpoint for user context
router.get("/", authMiddleware, getMe);
