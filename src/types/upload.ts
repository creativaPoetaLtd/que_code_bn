import { Request } from "express";

export interface Info<T> extends Request {
	info?: T;
}

export interface Message {
	message: string;
}