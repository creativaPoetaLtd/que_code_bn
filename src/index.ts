import app from "./app";
import { connectionToDatabase } from "./database/config/db.config";
import * as http from "http";
import {  PORT } from "./utils/keys";


const startServer = async () => {
	await connectionToDatabase();

	const server = http.createServer(app);

	server.listen(PORT, async () => {
		console.log(`Server is running at http://localhost:${PORT}`);
	});
};

startServer();