import { ErrorResponse } from "../response"
import { DTO } from "../types"

export type Connection = {
    id: string
    initiator: string
    connections: string[]
}

export type ConnectionDTO = DTO & Connection

export function buildConnectionFromDTO(connection: ConnectionDTO): Connection {
    try {
        return {
            id: connection.id,
            initiator: connection.initiator,
            connections: connection.connections
        }
    } catch (error) {
        throw new ErrorResponse(500, 'Server Failure')
    }
}
