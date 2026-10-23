import bcrypt from "bcryptjs";
import { db } from "./config/db.js";

export function seedDatabase() {
  const admin = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (!admin) {
    const adminPass = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO users (name, email, whatsapp, password_hash, business_name, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 'active', datetime('now'))
    `).run(
      "Administrator OkeIniAja",
      "admin@okeiniaja.com",
      "6281291311218",
      adminPass,
      "OkeIniAja Headquarter"
    );
    console.log("[Seed] Default admin account ready: admin@okeiniaja.com / admin123");
  }

  const client = db.prepare(`SELECT id FROM users WHERE role = 'client' LIMIT 1`).get() as any;
  let clientId = client?.id;

  if (!client) {
    const clientPass = bcrypt.hashSync("klien123", 10);
    const info = db.prepare(`
      INSERT INTO users (name, email, whatsapp, password_hash, business_name, website_url, instagram_handle, package_active, package_billing, package_expires_at, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+30 days'), 'client', 'active', datetime('now'))
    `).run(
      "Dony Purnama",
      "klien@okeiniaja.com",
      "6281291311218",
      clientPass,
      "Kopi Senja Nusantara",
      "https://kopisenja.com",
      "@kopisenja.official",
      "Standard Growth",
      "monthly"
    );
    clientId = Number(info.lastInsertRowid);
    console.log("[Seed] Default client account ready: klien@okeiniaja.com / klien123");

    db.prepare(`
      INSERT INTO orders (order_code, user_id, package_name, billing_cycle, amount, discount, total_amount, status, created_at, updated_at)
      VALUES ('ORD-202610-001', ?, 'Standard Growth', 'monthly', 199000, 0, 199000, 'active', datetime('now', '-3 days'), datetime('now', '-3 days'))
    `).run(clientId);

    db.prepare(`
      INSERT INTO job_activities (user_id, title, task_type, upload_date, article_url, social_url, check_image_opt, check_social_post, check_social_link, check_backup, article_count, photo_count, social_post_count, status, notes, created_at)
      VALUES (?, 'Publikasi Artikel: 5 Tips Memilih Biji Kopi Arabika Terbaik untuk Kedai Modern', 'article', date('now', '-1 day'), 'https://kopisenja.com/blog/tips-memilih-biji-kopi-arabika', 'https://instagram.com/p/DBc819SenjaTips', 1, 1, 1, 0, 1, 3, 2, 'completed', 'Keyword SEO on-page skor 94/100 di RankMath.', datetime('now', '-1 day'))
    `).run(clientId);

    db.prepare(`
      INSERT INTO job_activities (user_id, title, task_type, upload_date, article_url, social_url, check_image_opt, check_social_post, check_social_link, check_backup, article_count, photo_count, social_post_count, status, notes, created_at)
      VALUES (?, 'Optimasi 6 Foto Menu Baru Signature Latte & Pembaruan Banner Promo', 'photo', date('now', '-3 days'), '', 'https://instagram.com/p/DBa718SignatureMenu', 1, 1, 0, 0, 0, 6, 1, 'completed', 'Format WebP dikompresi rata-rata hemat 78%.', datetime('now', '-3 days'))
    `).run(clientId);

    db.prepare(`
      INSERT INTO job_activities (user_id, title, task_type, upload_date, article_url, social_url, check_image_opt, check_social_post, check_social_link, check_backup, article_count, photo_count, social_post_count, status, notes, created_at)
      VALUES (?, 'Backup Database & Source Code Bulanan (Siklus Oktober 2026)', 'backup', date('now', '-7 days'), '', '', 0, 0, 0, 1, 0, 0, 0, 'completed', 'Backup cloud storage terenkripsi.', datetime('now', '-7 days'))
    `).run(clientId);

    db.prepare(`
      INSERT INTO notifications (recipient_id, client_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, 'job', 'Pekerjaan Baru Selesai Dipublikasikan', 'Artikel SEO 5 Tips Memilih Biji Kopi Arabika telah tayang.', '/aktivitas', 0, datetime('now', '-1 hour'))
    `).run(clientId, clientId);
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDatabase();
  console.log("[Seed] Database seeding completed successfully.");
}
