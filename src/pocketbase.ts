import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8091';

export const pb = new PocketBase(PB_URL);
