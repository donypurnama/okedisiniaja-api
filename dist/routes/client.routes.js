"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_controller_js_1 = require("../controllers/client.controller.js");
const auth_js_1 = require("../middlewares/auth.js");
const uploadDir = path_1.default.resolve(__dirname, "../../uploads/proofs");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "proof-" + uniqueSuffix + ext);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
router.get("/overview", client_controller_js_1.getOverview);
router.get("/activities", client_controller_js_1.getActivities);
router.get("/orders", client_controller_js_1.getOrders);
router.post("/orders", client_controller_js_1.createOrder);
router.post("/payments", upload.single("proof"), client_controller_js_1.confirmPayment);
router.get("/notifications", client_controller_js_1.getNotifications);
router.put("/notifications/:id/read", client_controller_js_1.markNotificationRead);
router.put("/notifications/read-all", client_controller_js_1.markAllNotificationsRead);
exports.default = router;
