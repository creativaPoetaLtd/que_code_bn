import login from '../auth/login';
import express from 'express';
const loginRouter = express.Router();
loginRouter.post('/login', login.login_user);
export default loginRouter;