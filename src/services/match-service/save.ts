import { ClientResponseError } from "pocketbase"
import { Connection, ConnectionDTO, buildConnectionFromDTO } from "../../models/Connection"
import { User } from "../../models/User"
import { pb } from "../../pocketbase"

export async function createConnections(userId: string, users: User[]): Promise<Connection> {
    const connections = users.map(user => user.id)
    const data = { "initiator": userId, connections }
    const result = await pb.collection("connections").create(data) as ConnectionDTO
    return buildConnectionFromDTO(result)
}

export async function updateConnections({ id, connections }: Connection, users: User[]): Promise<Connection> {
    const ids = users.map(user => user.id)
    const data = { connections: [...connections, ...ids] }
    const result = await pb.collection("connections").update(id, data) as ConnectionDTO
    return buildConnectionFromDTO(result)
}

export async function getConnection(userId: string, users: User[]): Promise<Connection | null> {
    try {
        const filter = `initiator="${userId}"`
        const result = await pb.collection("connections").getFirstListItem(filter) as ConnectionDTO
        return buildConnectionFromDTO(result)
    } catch (error) {
        console.log("error fetching connection", error)
        if (error instanceof ClientResponseError && error.status === 404) {
            // TODO: hono log could not find connection with original error
            return null
        }

        // rethrow if not the expected 404 error
        throw error
    }
}
