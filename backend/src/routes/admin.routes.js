// src/routes/admin.routes.js
import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { PrismaClient } from "@prisma/client";

import { verifyJWT, requireRole } from "../middleware/auth.js";

import {
  // Orders / Users
  adminListOrders,
  adminListUsers,

  // Products
  adminListProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,

  // Analytics
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
// Toutes les routes admin sont protégées
router.use(verifyJWT, requireRole("ADMIN")); // selon ton implémentation, "admin" ou "ADMIN"

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
// Dossier d'upload (public)
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

// POST /api/admin/products/:id/files  (champ "files")
router.post("/products/:id/files", upload.array("files", 20), async (req, res) => {
  try {
    const { id: productId } = req.params;

    // Vérifie que le produit existe
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return res.status(404).json({ error: "Produit introuvable" });

    const files = req.files || [];
    if (!files.length) return res.json({ ok: true, count: 0 });

    const rows = files.map((f) => ({
      productId,
      url: "/uploads/" + path.basename(f.path), // accessible statiquement par Express
    }));

    await prisma.productImage.createMany({ data: rows });

    // Retourne la liste complète des images (optionnel)
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, count: rows.length, images });
  } catch (e) {
    console.error("[POST /admin/products/:id/files]", e);
    res.status(500).json({ error: "Upload échoué" });
  }
});

// DELETE /api/admin/products/:productId/images/:imageId
router.delete("/products/:productId/images/:imageId", async (req, res) => {
  try {
    const { productId, imageId } = req.params;

    // Vérifie l'image
    const img = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!img || img.productId !== productId) {
      return res.status(404).json({ error: "Image introuvable" });
    }

    // Supprime DB
    await prisma.productImage.delete({ where: { id: imageId } });

    // Supprime le fichier si présent
    if (img.url?.startsWith("/uploads/")) {
      const abs = path.join(UPLOAD_DIR, path.basename(img.url));
      fs.promises
        .unlink(abs)
        .catch(() => {}); // ne pas casser si déjà supprimé
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /admin/products/:productId/images/:imageId]", e);
    res.status(500).json({ error: "Suppression image échouée" });
  }
});

/* ====================== ANALYTICS ====================== */
// Ces 3 routes sont appelées par admin.page.js → loadStats()
router.get("/analytics/summary", analyticsSummary);
router.get("/analytics/funnel", analyticsFunnel);
router.get("/analytics/top-products", analyticsTopProducts);

/* ====================== SURVEYS (ADMIN) ====================== */
// Appelées par admin.page.js → loadSurveys()
router.get("/surveys", listSurveys);
router.get("/surveys/stats", surveyStats);

router.get("/me", adminMe);
router.put("/me", adminUpdateMe);
router.put("/me/password", adminChangePassword);

export default router;
