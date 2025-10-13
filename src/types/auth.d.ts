import { UserModelAttributes } from "./model";

declare global {
    namespace Express {
        interface User extends UserModelAttributes { } // Extend Express's User interface
    }
}