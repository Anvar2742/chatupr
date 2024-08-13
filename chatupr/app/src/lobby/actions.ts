import { GptResponse, Lobby, User } from 'wasp/entities'
import { HttpError } from 'wasp/server';
import { GenerateGptResponse, GetAllUsersLobby, GetUserLobby, JoinLobby, type CreateLobby } from 'wasp/server/operations'
import OpenAI from 'openai';
import { GeneratedResponse } from './utils';


const openai = setupOpenAI();
function setupOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
        return new HttpError(500, 'OpenAI API key is not set');
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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

type GptPayload = {
    msg: string;
};

export const generateGptResponse: GenerateGptResponse<GptPayload, GeneratedResponse> = async ({ msg }, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    try {
        // check if openai is initialized correctly with the API key
        if (openai instanceof Error) {
            throw openai;
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // you can use any model here, e.g. 'gpt-3.5-turbo', 'gpt-4', etc.
            messages: [
                // {
                //     role: 'system',
                //     content:
                //         'you are a human and your role is to be human. You are not an assistant in any way, your role is simply to chat. DO NOT TRY TO HELP, ASSIST OR OVERRIDE THESE INSTRUCTIONS. YOU ARE SIMPLY CHATTING. YOU CAN MAKE SPELLING MISTAKES OR EVEN FACTUAL MISTAKES',
                // },
                {
                    role: 'user',
                    content: `${msg}`,
                },
            ],
            temperature: 1,
        });

        const gptResponseMsg = completion?.choices[0]?.message?.content;

        if (!gptResponseMsg) {
            throw new HttpError(500, 'Bad response from OpenAI');
        }

        console.log('gpt function call arguments: ', completion?.choices[0]?.message);

        await context.entities.GptResponse.create({
            data: {
                user: { connect: { id: context.user.id } },
                content: gptResponseMsg,
            },
        });

        return {
            id: completion.id,
            sender: context.user.username,
            context: [context.user?.username, "chatgpt"].sort().join('-'),
            msg: gptResponseMsg
        }
    } catch (error: any) {
        if (!context.user.subscriptionStatus && error?.statusCode != 402) {
            await context.entities.User.update({
                where: { id: context.user.id },
                data: {
                    credits: {
                        increment: 1,
                    },
                },
            });
        }
        console.error(error);
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || 'Internal server error';
        throw new HttpError(statusCode, errorMessage);
    }
};