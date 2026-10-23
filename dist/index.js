"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const client_routes_js_1 = __importDefault(require("./routes/client.routes.js"));
const admin_routes_js_1 = __importDefault(require("./routes/admin.routes.js"));
const seed_js_1 = require("./seed.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// CORS setup
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve uploaded proof files
const uploadsPath = path_1.default.resolve(__dirname, "../uploads");
app.use("/uploads", express_1.default.static(uploadsPath));
// API Routes
app.use("/api/auth", auth_routes_js_1.default);
app.use("/api/client", client_routes_js_1.default);
app.use("/api/admin", admin_routes_js_1.default);
// Health check
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "okeiniaja-api",
        time: new Date().toISOString(),
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Endpoint API tidak ditemukan." });
});
// Seed default data if needed
try {
    (0, seed_js_1.seedDatabase)();
}
catch (e) {
    console.error("[Seed] Warning:", e);
}
app.listen(PORT, () => {
    console.log(`[Server] OkeIniAja REST API running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});
