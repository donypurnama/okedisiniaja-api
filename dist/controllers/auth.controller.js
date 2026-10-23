"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.getMe = getMe;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../config/db.js");
const auth_js_1 = require("../middlewares/auth.js");
const notification_service_js_1 = require("../services/notification.service.js");
function login(req, res) {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        res.status(400).json({ success: false, message: "Email / No. WhatsApp dan password wajib diisi." });
        return;
    }
    const raw = String(identifier).trim();
    const cleanWa = raw.replace(/[^0-9]/g, "");
    const cleanWaAlt = cleanWa.startsWith("0") ? "62" + cleanWa.slice(1) : cleanWa;
    try {
        const user = db_js_1.db
            .prepare(`
        SELECT * FROM users 
        WHERE (LOWER(email) = LOWER(?) OR whatsapp = ? OR whatsapp = ? OR whatsapp = ?) 
        AND status = 'active' 
        LIMIT 1
      `)
            .get(raw, raw, cleanWa, cleanWaAlt);
        if (!user || !bcryptjs_1.default.compareSync(password, user.password_hash)) {
            res.status(401).json({
                success: false,
                message: "Email / No. WhatsApp atau password yang Anda masukkan tidak sesuai.",
            });
            return;
        }
        // Update last login
        db_js_1.db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);
        const payload = {
            id: user.id,
            email: user.email,
            whatsapp: user.whatsapp,
            name: user.name,
            business_name: user.business_name,
            role: user.role,
        };
        const token = jsonwebtoken_1.default.sign(payload, auth_js_1.JWT_SECRET, { expiresIn: "30d" });
        const { password_hash, ...safeUser } = user;
        res.json({
            success: true,
            message: "Login berhasil",
            token,
            user: safeUser,
        });
    }
    catch (err) {
        console.error("[Auth] Login error:", err);
        res.status(500).json({ success: false, message: "Terjadi kesalahan internal: " + err.message });
    }
}
function register(req, res) {
    const { name, business_name, whatsapp, email, password } = req.body;
    if (!name || !business_name || !whatsapp || !email || !password) {
        res.status(400).json({ success: false, message: "Semua kolom pendaftaran wajib diisi." });
        return;
    }
    const cleanWa = String(whatsapp).replace(/[^0-9]/g, "");
    if (cleanWa.length < 9) {
        res.status(400).json({ success: false, message: "Nomor WhatsApp minimal 9 digit angka." });
        return;
    }
    const formattedWa = cleanWa.startsWith("0") ? "62" + cleanWa.slice(1) : cleanWa;
    if (String(password).length < 6) {
        res.status(400).json({ success: false, message: "Password minimal 6 karakter." });
        return;
    }
    try {
        // Check existing email
        const existingEmail = db_js_1.db
            .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`)
            .get(email.trim());
        if (existingEmail) {
            res.status(409).json({ success: false, message: "Alamat email ini sudah terdaftar." });
            return;
        }
        // Check existing whatsapp
        const existingWa = db_js_1.db
            .prepare(`SELECT id FROM users WHERE whatsapp = ? OR whatsapp = ? LIMIT 1`)
            .get(formattedWa, cleanWa);
        if (existingWa) {
            res.status(409).json({ success: false, message: "Nomor WhatsApp ini sudah terdaftar." });
            return;
        }
        const passwordHash = bcryptjs_1.default.hashSync(password, 10);
        const stmt = db_js_1.db.prepare(`
      INSERT INTO users (name, email, whatsapp, password_hash, business_name, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'client', 'active', datetime('now'), datetime('now'))
    `);
        const info = stmt.run(name.trim(), email.trim(), formattedWa, passwordHash, business_name.trim());
        const newId = Number(info.lastInsertRowid);
        // Welcome notification
        (0, notification_service_js_1.notifyUser)(newId, "account", "Selamat Datang di Portal Klien OkeIniAja!", "Akun Anda telah aktif. Silakan pilih paket pengelolaan yang sesuai dengan kebutuhan bisnis Anda.", "/pesan");
        // Notify admins
        (0, notification_service_js_1.notifyAdmins)('client', "Klien Baru Terdaftar", `Klien baru "${business_name.trim()}" (${name.trim()}) telah mendaftar di portal.`, "/admin/clients", newId);
        const payload = {
            id: newId,
            email: email.trim(),
            whatsapp: formattedWa,
            name: name.trim(),
            business_name: business_name.trim(),
            role: 'client',
        };
        const token = jsonwebtoken_1.default.sign(payload, auth_js_1.JWT_SECRET, { expiresIn: "30d" });
        const newUser = db_js_1.db.prepare(`SELECT * FROM users WHERE id = ?`).get(newId);
        const { password_hash, ...safeUser } = newUser;
        res.status(201).json({
            success: true,
            message: "Pendaftaran akun berhasil.",
            token,
            user: safeUser,
        });
    }
    catch (err) {
        console.error("[Auth] Register error:", err);
        res.status(500).json({ success: false, message: "Gagal menyimpan akun: " + err.message });
    }
}
function getMe(req, res) {
    try {
        const user = db_js_1.db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
            return;
        }
        const { password_hash, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function updateProfile(req, res) {
    const { name, business_name, website_url, instagram_handle, whatsapp } = req.body;
    try {
        const stmt = db_js_1.db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          business_name = COALESCE(?, business_name),
          website_url = COALESCE(?, website_url),
          instagram_handle = COALESCE(?, instagram_handle),
          whatsapp = COALESCE(?, whatsapp),
          updated_at = datetime('now')
      WHERE id = ?
    `);
        stmt.run(name, business_name, website_url, instagram_handle, whatsapp, req.user.id);
        const updated = db_js_1.db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
        const { password_hash, ...safeUser } = updated;
        res.json({ success: true, message: "Profil berhasil diperbarui.", user: safeUser });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function changePassword(req, res) {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
        res.status(400).json({ success: false, message: "Password lama dan baru wajib diisi." });
        return;
    }
    if (String(new_password).length < 6) {
        res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
        return;
    }
    try {
        const user = db_js_1.db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user.id);
        if (!user || !bcryptjs_1.default.compareSync(old_password, user.password_hash)) {
            res.status(400).json({ success: false, message: "Password lama tidak sesuai." });
            return;
        }
        const newHash = bcryptjs_1.default.hashSync(new_password, 10);
        db_js_1.db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, req.user.id);
        res.json({ success: true, message: "Password berhasil diubah." });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
