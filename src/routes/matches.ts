import { Router } from "express";
import { createMatchSchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";

export const matchRouter = Router();

matchRouter.get("/", (req, res) => {
  res.status(200).json({ message: "Matches List" });
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  try {
  } catch (err) {
    res.status(500).json({
      message: "Failed to create match",
      details: JSON.stringify(err),
    });
  }
});
