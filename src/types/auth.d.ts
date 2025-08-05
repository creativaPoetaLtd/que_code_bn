import { UserModelAttributes } from "./model";

declare global {
    namespace Express {
        interface User extends UserModelAttributes { } // Extend Express's User interface

        interface Request {
            user?: User; // Now using the extended interface
        }
    }
}