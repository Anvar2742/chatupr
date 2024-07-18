import { Game } from 'wasp/entities'
import { HttpError } from 'wasp/server';
import { type CreateGame } from 'wasp/server/operations'

// You don't need to use the arguments if you don't need them
export const createGame: CreateGame<void, Game> = async (
    _args, context
) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const game = await context.entities.Game.create({
        data: {
            hostId: context.user.id,
            users: { connect: { id: context.user.id } }
        },
    });

    return game;
}