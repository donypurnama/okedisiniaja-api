import { Router } from "express";
import {
  getClients,
  getClientDetail,
  resetClientPassword,
  getPayments,
  verifyPayment,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getInvoices,
} from "../controllers/admin.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/clients", getClients);
router.get("/clients/:id", getClientDetail);
router.put("/clients/:id/password", resetClientPassword);

router.get("/payments", getPayments);
router.post("/payments/:id/verify", verifyPayment);

router.get("/activities", getActivities);
router.post("/activities", createActivity);
router.put("/activities/:id", updateActivity);
router.delete("/activities/:id", deleteActivity);

router.get("/invoices", getInvoices);

export default router;
