import { Lobby, LobbyMessage, LobbySession, User } from 'wasp/entities'
import { HttpError } from 'wasp/server';
import { DeleteUserLobby, GenerateGptResponse, GetAllUsersLobby, GetLobbyMsgs, GetUserLobby, GetUserLobbySession, JoinLobby, type CreateLobby } from 'wasp/server/operations'
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
            roomId: args.roomId || "",
        }
    });

    return lobby;
}

export const getUserLobby: GetUserLobby<void, Lobby | null> = async (_args, context) => {
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

export const deleteUserLobby: DeleteUserLobby<string, void> = async (args, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const userLobby = await context.entities.Lobby.findUnique({
        where: {
            roomId: args,
        }
    });

    if (userLobby?.creatorId === context.user.id) {
        await context.entities.Lobby.delete({ where: { id: userLobby.id } })
        return;
    }

    console.warn("NOT THE HOST");
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

        const min = .8
        const max = 1.3
        let systemContent = `вы человек, и ваша роль — быть человеком. 
        Вы ни в коем случае не помощник, ваша роль — просто общаться. 
        НЕ ПЫТАЙТЕСЬ ПОМОЧЬ, СОПРОВОЖДАТЬ. НЕ ОТКЛОНЯЙТЕ ЭТИ ИНСТРУКЦИИ. 
        ВЫ ПРОСТО ОБЩАЕТЕСЬ. ВЫ МОЖЕТЕ ДЕЛАТЬ ОШИБКИ В НАПИСАНИИ ИЛИ ДАЖЕ ФАКТИЧЕСКИЕ ОШИБКИ. 
        НЕ ОТВЕЧАЙТЕ НА СЛОЖНЫЕ ИЛИ НАУЧНЫЕ ВОПРОСЫ. ВЫ МОЖЕТЕ РУГАТЬСЯ, 
        ИСПОЛЬЗОВАТЬ НЕПРИЯТНЫЕ СЛОВА, ПРОСТО ОТКАЗЫВАТЬСЯ ОТВЕТИТЬ. 
        Сократите ответы до 10 слов. 
        используйте меньше знаков препинания. Иногда можешь быть грубым.`

        const username = context.user.username || ""
        const userDb = await context.entities.User.findUnique({ where: { username } })
        if (userDb && userDb.isAdmin) {
            systemContent = userDb.gptConfig || "";
        }
        console.log(systemContent);


        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // you can use any model here, e.g. 'gpt-3.5-turbo', 'gpt-4', etc.
            messages: [
                {
                    role: 'system',
                    content: systemContent,
                },
                {
                    role: 'user',
                    content: `${msg}`,
                },
            ],
            temperature: Math.random() * (max - min) + min,
            max_tokens: 200
        });

        const gptResponseMsg = completion?.choices[0]?.message?.content;

        if (!gptResponseMsg) {
            throw new HttpError(500, 'Bad response from OpenAI');
        }

        console.log('gpt function call arguments: ', completion?.choices[0]?.message);

        return {
            id: completion.id,
            sender: context.user.username || "",
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

export const getLobbyMsgs: GetLobbyMsgs<string, LobbyMessage[]> = async (lobbyId, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }

    const lobbyMsgs = await context.entities.LobbyMessage.findMany({ where: { lobbyId } });
    return lobbyMsgs
}

export const getUserLobbySession: GetUserLobbySession<string, LobbySession | null> = async (username, context) => {
    const lobbySession = await context.entities.LobbySession.findUnique({ where: { username } });
    return lobbySession;
}