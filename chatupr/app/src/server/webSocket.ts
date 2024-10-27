import { Socket } from 'socket.io';
import { randomIntFromInterval } from 'wasp/ext-src/server/utils';
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket'
import { lobbyOperations } from './webSocket/LobbyOperations';

export const webSocketFn: WebSocketFn = (io, context) => {
    interface socketUser { socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>; }

    let lobbies: Record<string, { storeObj: Record<string, socketUser>; connectedClients: { username: string; isReady: boolean; isDetective: boolean; isRobot: boolean; isConnected: boolean; canPlay: boolean; isHost: boolean; }[] }> = {}; // Object to store lobbies data


    io.on('connection', (socket) => {
        if (!socket.data.user) return;

        const username = socket.data.user.getFirstProviderUserId() ?? "-1";
        if (username === "-1") return;

        console.log('a user connected: ', username);

        lobbyOperations(socket, lobbies, io, context, username);

        socket.on('chatMessage', async (msgInfo: chatMessageClientToServer) => {
            try {
                if (!msgInfo || !msgInfo.toUser || !msgInfo.content || !msgInfo.context) {
                    throw new Error("Invalid message information.");
                }

                const sender = msgInfo.isRobot ? "chatgpt" : username
                const recipient = msgInfo.toUser;
                const message = {
                    fromUser: sender,
                    content: msgInfo.content,
                    toUser: recipient,
                    lobbyId: msgInfo.lobbyId,
                };

                const dbLobbyMsg = await context.entities.LobbyMessage.create({
                    data: {
                        fromUser: sender,
                        toUser: recipient,
                        lobbyId: msgInfo.lobbyId,
                        content: msgInfo.content,
                        context: msgInfo.context,
                        isRobot: msgInfo.isRobot
                    }
                });

                io.emit("chatMessage", {
                    ...message,
                    context: msgInfo.context,
                    isRobot: msgInfo.isRobot,
                    createdAt: dbLobbyMsg.createdAt
                })
            } catch (error) {
                console.error("Error handling chatMessage event:", error);
            }
        });

        socket.on("desicion", async (desicion) => {
            try {
                const lobby = lobbies[desicion.lobbyId];
                if (desicion.username === "chatgpt") {
                    lobby.connectedClients = lobby.connectedClients.map(client => {
                        if (client.isDetective && client.username === username) {
                            client.canPlay = false;
                        }
                        return client
                    })
                    await context.entities.LobbySession.update({ where: { username }, data: { canPlay: false, isDetective: false } })

                    const copUsername = assignDetective(lobby)

                    await context.entities.LobbyMessage.deleteMany({ where: { lobbyId: desicion.lobbyId } });

                    await context.entities.LobbySession.update({ where: { username: copUsername }, data: { isDetective: true } })
                    await context.entities.Lobby.update({
                        where: {
                            roomId: desicion.lobbyId,
                        },
                        data: {
                            lobbyState: "game",
                            detectiveId: copUsername
                        }
                    })
                    io.emit("desicion", { isCorrect: false, clients: lobby.connectedClients, username: desicion.username, lobbyStatus: "end" })
                    return;
                }



                await context.entities.LobbySession.update({ where: { username: desicion.username }, data: { canPlay: false } })
                lobby.connectedClients = lobby.connectedClients.map(client => {
                    if (client.username === desicion.username) {
                        client.canPlay = false;
                    }
                    return client
                })

                if (lobby.connectedClients.filter(el => el.canPlay).length === 1) {
                    await context.entities.LobbyMessage.deleteMany({ where: { lobbyId: desicion.lobbyId } });
                    await context.entities.Lobby.update({
                        where: {
                            roomId: desicion.lobbyId,
                        },
                        data: {
                            lobbyState: "end",
                        }
                    })
                    io.emit("desicion", { isCorrect: true, clients: lobby.connectedClients, username: desicion.username, lobbyStatus: "end" })
                    return;
                }
                io.emit("desicion", { isCorrect: true, clients: lobby.connectedClients, username: desicion.username, lobbyStatus: "game" })
            } catch (err: any) {
                console.error("Error handling desicion event:", err);
            }
        })

        socket.on("restart", async (restart) => {
            try {
                const lobby = lobbies[restart.lobbyId];
                lobby.connectedClients = lobby.connectedClients.map(client => {
                    return {
                        ...client,
                        canPlay: true,
                        isDetective: false
                    }
                })
                await context.entities.LobbySession.updateMany({ where: { lobbyId: restart.lobbyId }, data: { isDetective: false, canPlay: true } })

                const randNum = randomIntFromInterval(0, lobby.connectedClients.length - 1);
                let copUsername = lobby.connectedClients[randNum].username
                lobby.connectedClients[randNum].isDetective = true

                await context.entities.LobbySession.update({ where: { username: copUsername }, data: { isDetective: true } })
                const updatedLobby = await context.entities.Lobby.update({
                    where: {
                        roomId: restart.lobbyId,
                    },
                    data: {
                        lobbyState: "game",
                        detectiveId: copUsername
                    }
                })
                console.log(updatedLobby);

                io.emit("restart", { clients: lobby.connectedClients, lobbyStatus: "game" })
            } catch (error) {
                console.error("Error handling restart event:", error);
            }
        })

        function assignDetective(lobby: any) {
            // Filter clients who can play
            const playersThatCanPlay = lobby.connectedClients.filter((client: { canPlay: boolean; }) => client.canPlay);

            // If there are no players that can play, return early
            if (playersThatCanPlay.length === 0) {
                console.error("No players available to be the detective.");
                return;
            }

            // Randomly select a detective from players that can play
            const randNum = randomIntFromInterval(0, playersThatCanPlay.length - 1);
            const detective = playersThatCanPlay[randNum];
            detective.isDetective = true;

            // Update the lobby's connected clients to reflect the new detective
            lobby.connectedClients = lobby.connectedClients.map((client: { username: string; }) =>
                client.username === detective.username ? detective : client
            );
            return detective.username
        }

        function randomIntFromInterval(min: number, max: number) {
            return Math.floor(Math.random() * (max - min + 1) + min);
        }

    })
}

// Typing our WebSocket function with the events and payloads
// allows us to get type safety on the client as well

type WebSocketFn = WebSocketDefinition<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>

type chatMessageServerToClient = {
    fromUser: string, context: string, content: string, isRobot: boolean, toUser: string, createdAt: Date, lobbyId: string
}

type chatMessageClientToServer = { context: string, content: string, toUser: string, isRobot: boolean, lobbyId: string }

type connectedClients = {
    username: string;
    isReady: boolean;
    isDetective: boolean;
    isRobot: boolean;
    isConnected: boolean;
    canPlay: boolean;
    isHost: boolean;
}[]

interface ServerToClientEvents {
    chatMessage: (msg: chatMessageServerToClient) => void;
    lobbyOperation: (serverLobbyInfo: {
        lobbyId: string, lobbyStatus: string, clients: connectedClients
    }) => void;
    desicion: (desicion: {
        isCorrect: boolean,
        clients: connectedClients,
        username: string, lobbyStatus: string
    }) => void;
    restart: (restart: {
        clients: connectedClients,
        lobbyStatus: string
    }) => void;
}

interface ClientToServerEvents {
    chatMessage: (msgInfo: chatMessageClientToServer) => void;
    lobbyOperation: (lobbyOptions: { action: string, lobbyId: string }) => void;
    desicion: (desicion: { username: string, lobbyId: string }) => void;
    restart: (lobbyInfo: { lobbyId: string }) => void;
}

interface InterServerEvents { }

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData { }