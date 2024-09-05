import { User } from "../../models/User"
import { Connection } from "../../models/Connection"
import { createConnections, getConnection, updateConnections } from "./save"
import { isWithinRange } from "./find-matches"

export function findMatches(currentUser: User, users: User[]): User[] {
    return users.filter(user => {
        if (user.age < currentUser.minAge || user.age > currentUser.maxAge) return
        if (currentUser.age < user.minAge || currentUser.age > user.maxAge) return
        if (!isWithinRange(currentUser, user)) return
        return user;
    })
}

export async function save(userId: string, users: User[]): Promise<Connection> {
    const connection = await getConnection(userId, users)
    if (!connection) return await createConnections(userId, users)
    return await updateConnections(connection, users)
}
