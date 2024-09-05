import haversine from "haversine-distance"
import { User } from "../../models/User"

export function isWithinRange(currentUser: User, user: User): boolean {
    const distance = haversine(
        { latitude: currentUser.latitude, longitude: currentUser.longitude },
        { latitude: user.latitude, longitude: user.longitude }
    )

    if (currentUser.maxDistance === 0) return true;
    if ((distance / 1000) > currentUser.maxDistance) return false;

    if (user.maxDistance === 0) return true;
    if ((distance / 1000) > user.maxDistance) return false;

    return true;
}
