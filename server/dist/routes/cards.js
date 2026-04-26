import { cards } from "../data/cards.js";
export async function registerCardRoutes(app) {
    app.get("/cards", async () => ({ cards }));
}
