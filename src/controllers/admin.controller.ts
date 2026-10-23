import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { notifyUser } from "../services/notification.service.js";

export function getClients(req: Request, res: Response): void {
  try {
    const clients = db
      .prepare(`
        SELECT u.id, u.name, u.email, u.whatsapp, u.business_name, u.website_url, 
               u.instagram_handle, u.package_active, u.package_billing, u.package_expires_at, 
               u.status, u.last_login_at, u.created_at,
               (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as total_orders,
               (SELECT COUNT(*) FROM job_activities WHERE user_id = u.id) as total_jobs
        FROM users u 
        WHERE u.role = 'client'
        ORDER BY u.id DESC
      `)
      .all();
    res.json({ success: true, data: clients });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function getClientDetail(req: Request, res: Response): void {
  const { id } = req.params;
  try {
    const client = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'client'`).get(id) as any;
    if (!client) {
      res.status(404).json({ success: false, message: "Klien tidak ditemukan." });
      return;
    }

    const orders = db.prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`).all(id);
    const payments = db.prepare(`SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC`).all(id);
    const jobs = db.prepare(`SELECT * FROM job_activities WHERE user_id = ? ORDER BY upload_date DESC, id DESC`).all(id);
    const leads = db.prepare(`SELECT * FROM leads WHERE user_id = ? ORDER BY id DESC`).all(id);

    const { password_hash, ...safeClient } = client;
    res.json({
      success: true,
      data: {
        client: safeClient,
        orders,
        payments,
        jobs,
        leads,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function resetClientPassword(req: Request, res: Response): void {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || String(new_password).length < 6) {
    res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
    return;
  }

  try {
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, id);
    res.json({ success: true, message: "Password akun klien berhasil diperbarui." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function getPayments(req: Request, res: Response): void {
  try {
    const payments = db
      .prepare(`
        SELECT p.*, o.order_code, o.package_name, o.billing_cycle, o.total_amount as order_amount,
               u.name as client_name, u.business_name as client_business, u.whatsapp as client_whatsapp
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        JOIN users u ON u.id = p.user_id
        ORDER BY p.id DESC
      `)
      .all();
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function verifyPayment(req: Request, res: Response): void {
  const { id } = req.params;
  const { decision = 'verified', admin_notes } = req.body;

  try {
    const payment = db
      .prepare(`
        SELECT p.*, o.package_name, o.billing_cycle, o.user_id as order_user_id
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.id = ?
      `)
      .get(id) as any;

    if (!payment) {
      res.status(404).json({ success: false, message: "Data pembayaran tidak ditemukan." });
      return;
    }

    const orderId = payment.order_id;
    const clientId = payment.order_user_id;
    const isYearly = payment.billing_cycle === "yearly";
    const intervalStr = isYearly ? "+365 days" : "+30 days";

    if (decision === 'verified') {
      db.prepare(`
        UPDATE payments 
        SET status = 'verified', verified_at = datetime('now'), admin_notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(admin_notes || null, id);

      db.prepare(`UPDATE orders SET status = 'active', updated_at = datetime('now') WHERE id = ?`).run(orderId);

      db.prepare(`
        UPDATE users 
        SET package_active = ?, 
            package_billing = ?, 
            package_expires_at = date('now', "${intervalStr}"),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(payment.package_name, payment.billing_cycle, clientId);

      notifyUser(
        clientId,
        "payment",
        "Pembayaran Diverifikasi & Paket Aktif!",
        `Pembayaran untuk paket ${payment.package_name} telah diverifikasi. Masa aktif diperpanjang hingga siklus berikutnya.`,
        "/invoice"
      );
    } else {
      const payStatus = decision === "rejected" ? "rejected" : "returned";
      db.prepare(`
        UPDATE payments 
        SET status = ?, admin_notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(payStatus, admin_notes || null, id);

      db.prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(orderId);

      notifyUser(
        clientId,
        "payment",
        "Pemberitahuan Status Pembayaran",
        `Pembayaran Anda ditolak/diretur dengan catatan: ${admin_notes || "Silakan hubungi admin WhatsApp."}`,
        "/pembayaran"
      );
    }

    res.json({ success: true, message: `Keputusan pembayaran "${decision}" berhasil diproses.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function getActivities(req: Request, res: Response): void {
  try {
    const list = db
      .prepare(`
        SELECT j.*, u.name as client_name, u.business_name as client_business
        FROM job_activities j
        JOIN users u ON u.id = j.user_id
        ORDER BY j.upload_date DESC, j.id DESC
      `)
      .all();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function createActivity(req: Request, res: Response): void {
  const {
    user_id,
    title,
    task_type = "article",
    upload_date,
    article_url,
    social_url,
    check_image_opt = false,
    check_social_post = false,
    check_social_link = false,
    check_backup = false,
    article_count = 1,
    photo_count = 0,
    social_post_count = 0,
    status = 'completed',
    notes,
  } = req.body;

  if (!user_id || !title || !upload_date) {
    res.status(400).json({ success: false, message: "Klien, judul pekerjaan, dan tanggal unggah wajib diisi." });
    return;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO job_activities (
        user_id, title, task_type, upload_date, article_url, social_url,
        check_image_opt, check_social_post, check_social_link, check_backup,
        article_count, photo_count, social_post_count, status, notes,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const info = stmt.run(
      user_id,
      title,
      task_type,
      upload_date,
      article_url || null,
      social_url || null,
      check_image_opt ? 1 : 0,
      check_social_post ? 1 : 0,
      check_social_link ? 1 : 0,
      check_backup ? 1 : 0,
      article_count,
      photo_count,
      social_post_count,
      status,
      notes || null
    );

    notifyUser(
      user_id,
      "job",
      "Pembaruan Pekerjaan Baru",
      `Tim admin telah menambahkan pekerjaan: "${title}".`,
      "/aktivitas"
    );

    const created = db.prepare(`SELECT * FROM job_activities WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ success: true, message: "Pekerjaan berhasil dicatat.", data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function updateActivity(req: Request, res: Response): void {
  const { id } = req.params;
  const {
    title,
    upload_date,
    article_url,
    social_url,
    check_image_opt,
    check_social_post,
    check_social_link,
    check_backup,
    article_count,
    photo_count,
    social_post_count,
    status,
    notes,
  } = req.body;

  try {
    const existing = db.prepare(`SELECT * FROM job_activities WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ success: false, message: "Pekerjaan tidak ditemukan." });
      return;
    }

    const stmt = db.prepare(`
      UPDATE job_activities 
      SET title = COALESCE(?, title),
          upload_date = COALESCE(?, upload_date),
          article_url = COALESCE(?, article_url),
          social_url = COALESCE(?, social_url),
          check_image_opt = COALESCE(?, check_image_opt),
          check_social_post = COALESCE(?, check_social_post),
          check_social_link = COALESCE(?, check_social_link),
          check_backup = COALESCE(?, check_backup),
          article_count = COALESCE(?, article_count),
          photo_count = COALESCE(?, photo_count),
          social_post_count = COALESCE(?, social_post_count),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      title,
      upload_date,
      article_url,
      social_url,
      check_image_opt !== undefined ? (check_image_opt ? 1 : 0) : null,
      check_social_post !== undefined ? (check_social_post ? 1 : 0) : null,
      check_social_link !== undefined ? (check_social_link ? 1 : 0) : null,
      check_backup !== undefined ? (check_backup ? 1 : 0) : null,
      article_count,
      photo_count,
      social_post_count,
      status,
      notes,
      id
    );

    res.json({ success: true, message: "Pekerjaan berhasil diperbarui." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function deleteActivity(req: Request, res: Response): void {
  const { id } = req.params;
  try {
    db.prepare(`DELETE FROM job_activities WHERE id = ?`).run(id);
    res.json({ success: true, message: "Pekerjaan berhasil dihapus." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export function getInvoices(req: Request, res: Response): void {
  try {
    const list = db
      .prepare(`
        SELECT o.*, u.name as client_name, u.business_name as client_business, u.whatsapp as client_whatsapp,
               p.status as payment_status, p.id as payment_id, p.transfer_amount, p.proof_file
        FROM orders o
        JOIN users u ON u.id = o.user_id
        LEFT JOIN payments p ON p.order_id = o.id
        ORDER BY o.id DESC
      `)
      .all();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
