import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getOverview,
  getActivities,
  getOrders,
  createOrder,
  confirmPayment,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/client.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const uploadDir = path.resolve(__dirname, "../../uploads/proofs");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "proof-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

router.use(requireAuth);

router.get("/overview", getOverview);
router.get("/activities", getActivities);
router.get("/orders", getOrders);
router.post("/orders", createOrder);
router.post("/payments", upload.single("proof"), confirmPayment);
router.get("/notifications", getNotifications);
router.put("/notifications/:id/read", markNotificationRead);
router.put("/notifications/read-all", markAllNotificationsRead);

export default router;
