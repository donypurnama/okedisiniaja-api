"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOverview = getOverview;
exports.getActivities = getActivities;
exports.getOrders = getOrders;
exports.createOrder = createOrder;
exports.confirmPayment = confirmPayment;
exports.getNotifications = getNotifications;
exports.markNotificationRead = markNotificationRead;
exports.markAllNotificationsRead = markAllNotificationsRead;
const db_js_1 = require("../config/db.js");
const notification_service_js_1 = require("../services/notification.service.js");
function getOverview(req, res) {
    try {
        const userId = req.user.id;
        const user = db_js_1.db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
        const completedJobs = db_js_1.db
            .prepare(`SELECT * FROM job_activities WHERE user_id = ? AND status = 'completed'`)
            .all(userId);
        const publishedArticles = completedJobs.reduce((acc, curr) => acc + (curr.article_count || 0), 0);
        const optimizedPhotos = completedJobs.reduce((acc, curr) => acc + (curr.photo_count || 0), 0);
        const socialPosts = completedJobs.reduce((acc, curr) => acc + (curr.social_post_count || 0), 0);
        const backups = completedJobs.filter((j) => j.check_backup).length;
        const recentJobs = db_js_1.db
            .prepare(`SELECT * FROM job_activities WHERE user_id = ? ORDER BY upload_date DESC, id DESC LIMIT 5`)
            .all(userId);
        const pendingOrders = db_js_1.db
            .prepare(`SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'pending_payment'`)
            .get(userId);
        res.json({
            success: true,
            data: {
                package_active: user.package_active || "Belum Memiliki Paket",
                package_billing: user.package_billing || "monthly",
                package_expires_at: user.package_expires_at || null,
                quota: {
                    articles: { used: publishedArticles, limit: 4 },
                    photos: { used: optimizedPhotos, limit: 20 },
                    social: { used: socialPosts, limit: 12 },
                    backup: { used: backups, limit: 1 },
                },
                recent_jobs: recentJobs,
                has_pending_payment: (pendingOrders?.count || 0) > 0,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function getActivities(req, res) {
    try {
        const jobs = db_js_1.db
            .prepare(`SELECT * FROM job_activities WHERE user_id = ? ORDER BY upload_date DESC, id DESC`)
            .all(req.user.id);
        res.json({ success: true, data: jobs });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function getOrders(req, res) {
    try {
        const orders = db_js_1.db
            .prepare(`
        SELECT o.*, p.status as payment_status, p.proof_file, p.transfer_amount, p.id as payment_id
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.user_id = ?
        ORDER BY o.id DESC
      `)
            .all(req.user.id);
        res.json({ success: true, data: orders });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function createOrder(req, res) {
    const { package_name, billing_cycle = "monthly", amount, discount = 0, voucher_code, notes } = req.body;
    if (!package_name || !amount) {
        res.status(400).json({ success: false, message: "Nama paket dan jumlah biaya wajib diisi." });
        return;
    }
    try {
        const totalAmount = Math.max(0, Number(amount) - Number(discount));
        const countToday = db_js_1.db.prepare(`SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')`).get();
        const orderIndex = String((countToday?.c || 0) + 1).padStart(3, "0");
        const d = new Date();
        const dateCode = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
        const orderCode = `ORD-${dateCode}-${orderIndex}`;
        const stmt = db_js_1.db.prepare(`
      INSERT INTO orders (order_code, user_id, package_name, billing_cycle, amount, discount, total_amount, voucher_code, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', datetime('now'), datetime('now'))
    `);
        const info = stmt.run(orderCode, req.user.id, package_name, billing_cycle, amount, discount, totalAmount, voucher_code || null, notes || null);
        (0, notification_service_js_1.notifyAdmins)("order", "Pesanan Layanan Baru", `Klien ${req.user.business_name || req.user.name} memesan paket ${package_name} (${orderCode}).`, "/admin/invoices", req.user.id);
        const created = db_js_1.db.prepare(`SELECT * FROM orders WHERE id = ?`).get(info.lastInsertRowid);
        res.status(201).json({ success: true, message: "Pesanan berhasil dibuat.", data: created });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function confirmPayment(req, res) {
    const { order_id, bank_destination, sender_bank, sender_name, transfer_amount, transfer_date, notes } = req.body;
    const proofFile = req.file ? `uploads/proofs/${req.file.filename}` : null;
    if (!order_id || !bank_destination || !sender_name || !transfer_amount || !transfer_date) {
        res.status(400).json({ success: false, message: "Semua kolom konfirmasi pembayaran wajib diisi." });
        return;
    }
    try {
        const order = db_js_1.db.prepare(`SELECT * FROM orders WHERE id = ? AND user_id = ?`).get(order_id, req.user.id);
        if (!order) {
            res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
            return;
        }
        const stmt = db_js_1.db.prepare(`
      INSERT INTO payments (order_id, user_id, bank_destination, sender_bank, sender_name, transfer_amount, transfer_date, proof_file, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `);
        const info = stmt.run(order_id, req.user.id, bank_destination, sender_bank || null, sender_name, transfer_amount, transfer_date, proofFile, notes || null);
        // Update order status to reviewing
        db_js_1.db.prepare(`UPDATE orders SET status = 'reviewing', updated_at = datetime('now') WHERE id = ?`).run(order_id);
        (0, notification_service_js_1.notifyAdmins)("payment", "Konfirmasi Pembayaran Masuk", `Klien ${req.user.business_name || req.user.name} mengunggah bukti transfer Rp ${Number(transfer_amount).toLocaleString("id-ID")}.`, "/admin/payments", req.user.id);
        const payment = db_js_1.db.prepare(`SELECT * FROM payments WHERE id = ?`).get(info.lastInsertRowid);
        res.status(201).json({ success: true, message: "Bukti pembayaran berhasil dikirim untuk verifikasi admin.", data: payment });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function getNotifications(req, res) {
    try {
        const list = db_js_1.db
            .prepare(`SELECT * FROM notifications WHERE recipient_id = ? ORDER BY id DESC LIMIT 50`)
            .all(req.user.id);
        res.json({ success: true, data: list });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function markNotificationRead(req, res) {
    try {
        const { id } = req.params;
        db_js_1.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?`).run(id, req.user.id);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function markAllNotificationsRead(req, res) {
    try {
        db_js_1.db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ?`).run(req.user.id);
        res.json({ success: true, message: "Semua notifikasi ditandai sudah dibaca." });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
