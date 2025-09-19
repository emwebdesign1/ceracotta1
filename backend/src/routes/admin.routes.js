import { Router } from "express";
import { verifyJWT, requireRole } from "../middleware/auth.js";
import {
  adminListOrders,
  adminListUsers,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct
} from "../controllers/admin.controller.js";

const r = Router();

// Toutes les routes admin exigent un JWT + rôle ADMIN
r.use(verifyJWT, requireRole("ADMIN"));

// Produits CRUD
r.post("/products", adminCreateProduct);
r.patch("/products/:id", adminUpdateProduct);
r.delete("/products/:id", adminDeleteProduct);

// Listes
r.get("/orders", adminListOrders);
r.get("/users", adminListUsers);

export default r;
