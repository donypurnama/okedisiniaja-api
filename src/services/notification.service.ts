import { db } from "../config/db.js";

export function notifyUser(
  recipientId: number,
  type: string,
  title: string,
  message: string,
  link?: string,
  clientId?: number | null
) {
  if (recipientId <= 0) return;
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (recipient_id, client_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `);
    stmt.run(recipientId, clientId || null, type, title, message, link || null);
  } catch (err) {
    console.error("[Notification] Error creating user notification:", err);
  }
}

export function notifyAdmins(
  type: string,
  title: string,
  message: string,
  link?: string,
  clientId?: number | null
) {
  try {
    const admins = db
      .prepare(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`)
      .all() as { id: number }[];

    for (const admin of admins) {
      notifyUser(admin.id, type, title, message, link, clientId);
    }
  } catch (err) {
    console.error("[Notification] Error notifying admins:", err);
  }
}
