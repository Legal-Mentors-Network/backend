import type { Context } from 'hono'
import { StatusCode } from 'hono/utils/http-status'
import { ClientResponseError } from 'pocketbase';
import { authenticate } from './auth';

export class ErrorResponse {
    constructor(status: StatusCode, message: string) {
        this.message = message;
        this.status = status;
    }

    message;
    status;
}

export async function guard<T>(ctx: Context, callback: () => Promise<T>){
    try {
        const loginSuccess = await authenticate()
        if (!loginSuccess) throw new ErrorResponse(500, 'Service failure');
        return await callback();
    } catch (error) {
        console.log('error', error)
        if (error instanceof ErrorResponse) {
            ctx.status(error.status)
            return ctx.json({ message: error.message })
        }

        if (error instanceof ClientResponseError) {
            ctx.status(error.status as StatusCode)
            return ctx.json({ message: error.message })
        }

        ctx.status(500)
        return ctx.json({ message: "Unknown server error" })
    }
}
