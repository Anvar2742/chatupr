import { Lobby } from 'wasp/entities'
import { HttpError } from 'wasp/server';
import { GetUserLobby, JoinLobby, type CreateLobby } from 'wasp/server/operations'

// You don't need to use the arguments if you don't need them
export const createLobby: CreateLobby<Pick<Lobby, "roomId">, Lobby> = async (
    args, context
) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const existingLobby = await context.entities.Lobby.findUnique({
        where: { creatorId: context.user.id },
    });

    if (existingLobby) {
        throw new HttpError(401, "Room already exists");
    }

    const lobby = await context.entities.Lobby.create({
        data: {
            roomId: args.roomId,
            description: "cool",
            members: { connect: { id: context.user.id } },
            creatorId: context.user.id
        },
    });

    return lobby;
}

export const joinLobby: JoinLobby<Pick<Lobby, "roomId">, Lobby> = async (
    args, context
) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const lobby = await context.entities.Lobby.update({
        data: {
            description: "cool",
            members: { connect: { id: context.user.id } },
        },
        where: {
            roomId: args.roomId,
        }
    });

    return lobby;
}

export const getUserLobby: GetUserLobby<void, Lobby> = async (_args, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const userLobby = await context.entities.Lobby.findFirst({
        where: {
            OR: [
                { creatorId: context.user.id },
                { members: { some: { id: context.user.id } } }
            ],
        },
    });

    return userLobby
}