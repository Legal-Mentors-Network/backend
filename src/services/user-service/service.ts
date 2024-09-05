import { User, UserDTO, buildUserFromDTO } from "../../models/User"
import { pb } from "../../pocketbase"
import { Role } from "../../types"

export async function getUser(id: string): Promise<User> {
    const result = await pb.collection("user_for_match").getFirstListItem(`id="${id}"`) as UserDTO
    return buildUserFromDTO(result)
}

export async function getUsers(role: Role): Promise<User[]> {
    const filter = `role = "${role}"`
    const result = await pb.collection("user_for_match").getFullList({ filter }) as UserDTO[]
    return result.map(user => buildUserFromDTO(user))
}

export async function getMatchedUsers(users: string[]): Promise<User[]> {
    if (users.length === 0) return []
    const filter = users.map(id => `id="${id}"`).join(" || ")
    const results = await pb.collection("user_for_match").getFullList({ filter }) as UserDTO[]
    return results.map(user => buildUserFromDTO(user))
}

export async function getMentees(): Promise<User[]> {
    return getUsers("Mentee")
}

export async function getMentors(): Promise<User[]> {
    return getUsers("Mentor")
}
