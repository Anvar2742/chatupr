import { Lobby, User } from 'wasp/entities'
import { HttpError } from 'wasp/server';
import { GetAllUsersLobby, GetUserLobby, JoinLobby, type CreateLobby } from 'wasp/server/operations'

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
            members: { connect: { id: context.user.id } },
            creatorId: context.user.id,
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
        include: {
            members: true, // Include all members of the lobby
        },
    });

    return userLobby
}


export const getAllUsersLobby: GetAllUsersLobby<void, User[]> = async (_args, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    // Find the lobby that the user is a member of
    const lobby = await context.entities.Lobby.findFirst({
        where: {
            members: {
                some: {
                    id: context.user.id,
                },
            },
        },
        include: {
            members: true, // Include all members of the lobby
        },
    });

    if (!lobby) {
        throw new HttpError(404, 'Lobby not found');
    }

    // Return the list of members
    return lobby.members;
};

