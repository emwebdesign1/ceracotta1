// src/routes/admin.routes.js
import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { PrismaClient } from "@prisma/client";

import { verifyJWT, requireRole } from "../middleware/auth.js";

import {
  adminListOrders,
  adminListUsers,
  adminListProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  analyticsSummary,
  analyticsFunnel,
  analyticsTopProducts,
  adminMe,
  adminUpdateMe,
  adminChangePassword,
} from "../controllers/admin.controller.js";

import { listSurveys, surveyStats } from "../controllers/survey.controller.js";

const prisma = new PrismaClient();
const router = Router();

/* ====================== PROTECTION ====================== */
router.use(verifyJWT, requireRole("ADMIN"));

/* ====================== ORDERS ====================== */
router.get("/orders", adminListOrders);

/* ====================== USERS ====================== */
router.get("/users", adminListUsers);

/* ====================== PRODUCTS (CRUD) ====================== */
router.get("/products", adminListProducts);
router.get("/products/:id", adminGetProduct);
router.post("/products", adminCreateProduct);
router.put("/products/:id", adminUpdateProduct);
router.delete("/products/:id", adminDeleteProduct);

/* ====================== PRODUCT FILES (upload & delete) ====================== */
const UPLOAD_DIR = path.resolve("public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}_${base}${ext}`);
  },
});
const upload = multer({ storage });

// ✅ Upload files
router.post("/products/:id/files", upload.array("files", 20), async (req, res) => {
  try {
    const { id: productId } = req.params;
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return res.status(404).json({ error: "Produit introuvable" });

    const files = req.files || [];
    if (!files.length) return res.json({ ok: true, count: 0 });

    const rows = files.map((f) => ({
      productId,
      url: "/uploads/" + path.basename(f.path),
    }));

    await prisma.productimage.createMany({ data: rows });

    const images = await prisma.productimage.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, count: rows.length, images });
  } catch (e) {
    console.error("[POST /admin/products/:id/files]", e);
    res.status(500).json({ error: "Upload échoué" });
  }
});

// ✅ Delete file
router.delete("/products/:productId/images/:imageId", async (req, res) => {
  try {
    const { productId, imageId } = req.params;

    const img = await prisma.productimage.findUnique({ where: { id: imageId } });
    if (!img || img.productId !== productId) {
      return res.status(404).json({ error: "Image introuvable" });
    }

    await prisma.productimage.delete({ where: { id: imageId } });

    if (img.url?.startsWith("/uploads/")) {
      const abs = path.join(UPLOAD_DIR, path.basename(img.url));
      fs.promises.unlink(abs).catch(() => {});
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /admin/products/:productId/images/:imageId]", e);
    res.status(500).json({ error: "Suppression image échouée" });
  }
});

/* ====================== ANALYTICS ====================== */
router.get("/analytics/summary", analyticsSummary);
router.get("/analytics/funnel", analyticsFunnel);
router.get("/analytics/top-products", analyticsTopProducts);

/* ====================== SURVEYS (ADMIN) ====================== */
router.get("/surveys", listSurveys);
router.get("/surveys/stats", surveyStats);

/* ====================== PROFIL ADMIN ====================== */
router.get("/me", adminMe);
router.put("/me", adminUpdateMe);
router.put("/me/password", adminChangePassword);

export default router;
