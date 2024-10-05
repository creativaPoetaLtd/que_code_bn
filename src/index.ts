import "reflect-metadata";
import express, { Request, Response } from "express";
import Database from "./config/database";

const app = express();
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
    res.send("Hello World");
});

const start = async (): Promise<void> => {
    try {
        const db = new Database();
        await db.sequelize?.authenticate(); 
        
        console.log("Database connected");

        app.listen(3000, () => {
            console.log("Server started on port 3000");
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

void start();
