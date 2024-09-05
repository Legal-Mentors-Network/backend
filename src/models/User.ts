import { ErrorResponse } from "../response"
import { DTO, Role } from "../types"

export type User = {
    id: string,
    name: string,
    age: number
    role: Role,
    location: string,
    latitude: number,
    longitude: number,
    minAge: number,
    maxAge: number,
    maxDistance: number,
}

export type UserDTO = DTO & User & {
    latitude: string,
    longitude: string,
}

export function buildUserFromDTO(user: UserDTO): User {
    try {
        return {
            id: user.id,
            name: user.name,
            role: user.role,
            age: user.age,
            location: user.location,
            latitude: parseFloat(user.latitude),
            longitude: parseFloat(user.longitude),
            minAge: user.minAge,
            maxAge: user.maxAge,
            maxDistance: user.maxDistance ?? 0,
        }
    } catch (error) {
        throw new ErrorResponse(500, 'Server Failure')
    }
}
