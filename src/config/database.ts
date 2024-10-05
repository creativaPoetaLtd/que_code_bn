import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();
class Database {
    public sequelize: Sequelize | undefined;
    private POSTGRES_DB: string = process.env.POSTGRES_DB || "postgres";
    private POSTGRES_USER: string = process.env.POSTGRES_USER || "postgres";
    private POSTGRES_PASSWORD: string = process.env.POSTGRES_PASSWORD || "postgres";
    private POSTGRES_HOST: string = process.env.POSTGRES_HOST || "localhost";
    private POSTGRES_PORT: number = parseInt(process.env.POSTGRES_PORT || "5432");

    constructor() {
        this.connectToPostgres();
    }
    private async connectToPostgres(){
        this.sequelize = new  Sequelize({
            database: this.POSTGRES_DB,
            username: this.POSTGRES_USER,
            password: this.POSTGRES_PASSWORD,
            host: this.POSTGRES_HOST,
            port: this.POSTGRES_PORT,
            dialect: "postgres",
        });
        await this.sequelize.authenticate().then(() => {
            console.log("Connection to Postgres has been established successfully.");
        }).catch((error) => {
            console.error("Unable to connect to the database:", error);
        });
    }
}

export default Database; 