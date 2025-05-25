import { Request } from 'express';
import { UserModelAttributes } from './model';

export interface AuthenticatedRequest extends Request {
    user: UserModelAttributes;
}
