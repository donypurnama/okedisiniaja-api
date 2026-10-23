"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUser = notifyUser;
exports.notifyAdmins = notifyAdmins;
const db_js_1 = require("../config/db.js");
function notifyUser(recipientId, type, title, message, link, clientId) {
    if (recipientId <= 0)
        return;
    try {
        const stmt = db_js_1.db.prepare(`
      INSERT INTO notifications (recipient_id, client_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `);
        stmt.run(recipientId, clientId || null, type, title, message, link || null);
    }
    catch (err) {
        console.error("[Notification] Error creating user notification:", err);
    }
}
function notifyAdmins(type, title, message, link, clientId) {
    try {
        const admins = db_js_1.db
            .prepare(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`)
            .all();
        for (const admin of admins) {
            notifyUser(admin.id, type, title, message, link, clientId);
        }
    }
    catch (err) {
        console.error("[Notification] Error notifying admins:", err);
    }
}
