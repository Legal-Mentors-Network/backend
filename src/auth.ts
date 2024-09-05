import { ClientResponseError } from 'pocketbase';
import { pb } from './pocketbase'

export async function authenticate(): Promise<boolean> {
    try {
        await pb.admins.authWithPassword("admin@mail.com", "Password123")
    } catch (error) {
        console.log('error: ', error)
        if (error instanceof ClientResponseError) {
            // TODO hono log original error
            console.log('error: ', error.status, error.message, error.url)
        }
        return false;
    }

    return true;
}
