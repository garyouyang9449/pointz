import { categories } from "../data/categories.js";
export async function registerCategoryRoutes(app) {
    app.get("/categories", async () => ({ categories }));
}
