import { Router } from "express";
import { verifyJWT, requireRole } from "../middleware/auth.js";
import {
  adminListOrders,
  adminListUsers,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminListProducts,
  adminGetProduct,

  // ⬇️ alias des exports du contrôleur vers les noms attendus ici
  adminAnalyticsSummary as analyticsSummary,
  adminAnalyticsFunnel as analyticsFunnel,
  adminAnalyticsTopProducts as analyticsTopProducts,
} from "../controllers/admin.controller.js";

import multer from "multer";
import path from "path";
import fs from "fs";
import { listSurveys, surveyStats } from '../controllers/survey.controller.js';

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// === Config Multer (multi-fichiers) ===
const uploadDir = path.join(process.cwd(), "public", "uploads");
ensureDir(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "files-" + unique + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) cb(null, true);
  else cb(new Error("Type de fichier non supporté"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { files: 12, fileSize: 15 * 1024 * 1024 }
});

const r = Router();

// Toutes les routes admin exigent un JWT + rôle ADMIN
r.use(verifyJWT, requireRole("ADMIN"));

// ===== Produits CRUD + LISTE =====
r.get("/products", adminListProducts);
r.post("/products", adminCreateProduct);
r.put("/products/:id", adminUpdateProduct);
r.delete("/products/:id", adminDeleteProduct);
r.get("/products/:id", adminGetProduct);   // lecture 1 produit

// ===== Analytics =====
r.get("/analytics/summary", analyticsSummary);
r.get("/analytics/funnel", analyticsFunnel);
r.get("/analytics/top-products", analyticsTopProducts);

// ===== Upload multi-fichiers (images/vidéos) =====
r.post("/products/:id/files", upload.array("files", 12), async (req, res, next) => {
  try {
    const { id } = req.params; // CUID string
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // 0) garde-fous
    if (!req.files?.length) {
      return res.status(400).json({ ok: false, message: "Aucun fichier reçu." });
    }
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ ok: false, message: "Produit introuvable." });
    }

    // 1) récupérer la position max existante pour éviter les collisions @@unique([productId, position])
    const agg = await prisma.productImage.aggregate({
      where: { productId: id },
      _max: { position: true },
    });
    let startPos = (agg._max.position ?? -1) + 1;

    // 2) construire les lignes d'images
    const imageRows = req.files.map((f, i) => ({
      productId: id,
      url: `/uploads/${f.filename}`,
      position: startPos + i,
    }));

    // 3) insert en masse
    if (imageRows.length) {
      await prisma.productImage.createMany({ data: imageRows });
    }

    // 4) retour
    return res.json({ ok: true, files: imageRows.map(f => f.url) });
  } catch (e) {
    console.error("[UPLOAD ERROR]", e?.message, e?.code, e?.meta || "");
    return res.status(500).json({ ok: false, message: e?.message || "Erreur upload" });
  }
});

// ===== Suppression d’une image par id (id = String/cuid) =====
r.delete("/products/:id/images/:imageId", async (req, res, next) => {
  try {
    const { id, imageId } = req.params; // id produit (String), imageId (String)
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const img = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!img) return res.status(404).json({ ok: false, message: "Image introuvable." });
    if (img.productId !== id) {
      return res.status(400).json({ ok: false, message: "Image n’appartient pas à ce produit." });
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    // supprimer le fichier physique si présent
    const abs = path.join(process.cwd(), "public", img.url.replace(/^\//, ""));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);

    return res.json({ ok: true });
  } catch (e) {
    console.error("[IMG DELETE ERROR]", e?.message);
    return res.status(500).json({ ok: false, message: e?.message || "Erreur suppression image" });
  }
});

// (⚠️ NOTE) La fonction ci-dessous utilise document/window → c'est pour le front,
// pas pour Express. Elle ne sera pas appelée côté serveur.
// Je la laisse telle quelle puisque tu l'avais dans la base.
function renderImages(images, productId) {
  const container = document.getElementById("images-list"); // adapte selon ton HTML
  container.innerHTML = "";

  images.forEach(img => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-wrapper";

    const imageEl = document.createElement("img");
    imageEl.src = img.url;
    imageEl.alt = "Product image";

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "✖";
    delBtn.onclick = async () => {
      if (!confirm("Supprimer cette image ?")) return;
      try {
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}/images/${img.id}`, {
          method: "DELETE",
          headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error("Erreur suppression image");
        // retirer du DOM
        wrapper.remove();
      } catch (e) {
        alert("Impossible de supprimer : " + e.message);
      }
    };

    wrapper.appendChild(imageEl);
    wrapper.appendChild(delBtn);
    container.appendChild(wrapper);
  });
}

// ===== Listes =====
r.get("/orders", adminListOrders);
r.get("/users", adminListUsers);

// Sondages
r.get('/surveys', listSurveys);
r.get('/surveys/stats', surveyStats);

export default r;
