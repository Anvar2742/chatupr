import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid'
import { randomIntFromInterval } from 'wasp/ext-src/server/utils';
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket'

export const webSocketFn: WebSocketFn = (io, context) => {
    interface socketUser { socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>; }

    let lobbies: Record<string, { storeObj: Record<string, socketUser>; connectedClients: { username: string; isReady: boolean; isDetective: boolean; isRobot: boolean; }[] }> = {}; // Object to store lobbies data

    io.on('connection', (socket) => {
        if (!socket.data.user) return;

        const username = socket.data.user.getFirstProviderUserId() ?? "-1";
        if (username === "-1") return;

        console.log('a user connected: ', username);

        socket.on('lobbyOperation', async (options) => {
            if (!socket.data.user || !options.lobbyId) return;

            const lobbyId = options.lobbyId;

            // Initialize the lobby if it doesn't exist
            if (!lobbies[lobbyId]) {
                lobbies[lobbyId] = {
                    storeObj: {},
                    connectedClients: []
                };
            }

            const lobby = lobbies[lobbyId];
            const clients = io.sockets.adapter.rooms.get(lobbyId);

            if (options.action === "leave") {
                if (clients?.size && clients.size > 0) {
                    console.log("trying to leave");

                    const lobbyFromDb = await context.entities.Lobby.findUnique({
                        where: { roomId: lobbyId },
                        include: { members: true } // Ensure we include members to update them later
                    });

                    if (!lobbyFromDb) {
                        console.error("Lobby not found");
                        return;
                    }

                    const userId = socket.data.user?.id;
                    if (!userId) {
                        console.error("User not authenticated");
                        return;
                    }

                    // Remove the player from the lobby's members in the database
                    await context.entities.Lobby.update({
                        where: { roomId: lobbyId },
                        data: {
                            members: {
                                disconnect: { id: userId } // Disconnect the leaving member
                            }
                        }
                    });

                    // Remove the player from the lobby's connected clients
                    const userIndex = lobby.connectedClients.findIndex(client => client.username === username);
                    if (userIndex !== -1) {
                        lobby.connectedClients.splice(userIndex, 1);
                    }

                    // Leave the socket room
                    await socket.leave(lobbyId);

                    if (lobbyFromDb.creatorId === userId || lobby.connectedClients.length === 0) {
                        console.log("User is the host or it was the last client, deleting lobby");

                        // Delete the lobby from the database
                        await context.entities.Lobby.delete({ where: { roomId: lobbyId } });

                        io.to(lobbyId).emit('lobbyOperation', {
                            lobbyId: lobbyId,
                            lobbyStatus: "dead",
                            clients: []
                        });

                        // Optionally, clean up the in-memory lobby if no users are left
                        if (lobby.connectedClients.length === 0) {
                            delete lobbies[lobbyId];
                        }
                    } else {
                        // Notify others in the lobby that a player has left
                        io.to(lobbyId).emit('lobbyOperation', {
                            lobbyId: lobbyId,
                            lobbyStatus: "updated",
                            clients: lobby.connectedClients
                        });
                    }
                } else {
                    console.error("No clients in the lobby or lobby doesn't exist");
                }
            }


            if (options.action === "join") {
                if (clients?.size && clients.size > 0) {
                    await socket.join(lobbyId);
                    lobby.storeObj[username] = { socket: socket };

                    // Use `find` to check if the user already exists
                    const existingUser = lobby.connectedClients.find(client => client.username === username);

                    if (!existingUser) {
                        const lobbyFromDb = await context.entities.Lobby.findUnique({ where: { roomId: lobbyId } });
                        const isDetective = lobbyFromDb?.detectiveId === username;
                        lobby.connectedClients.push({ username, isReady: false, isDetective, isRobot: false });

                    }
                    console.log("clients: ", lobby.connectedClients);

                    // Remove duplicate entries for the same user
                    lobby.connectedClients = removeDuplicateClients(lobby.connectedClients);

                    io.to(lobbyId).emit('lobbyOperation', {
                        lobbyId: lobbyId,
                        lobbyStatus: "alive",
                        clients: lobby.connectedClients
                    });
                } else {
                    // Clear and reinitialize the lobby if it was previously empty
                    lobby.connectedClients = [];
                    await socket.join(lobbyId);
                    lobby.storeObj[username] = { socket: socket };

                    const lobbyFromDb = await context.entities.Lobby.findUnique({ where: { roomId: lobbyId } });
                    const isDetective = lobbyFromDb?.detectiveId === username;
                    lobby.connectedClients.push({ username, isReady: false, isDetective, isRobot: false });

                    console.info(`[CREATE] Client created and joined lobby ${lobbyId}`);

                    io.to(lobbyId).emit('lobbyOperation', {
                        lobbyId: lobbyId,
                        lobbyStatus: "alive",
                        clients: lobby.connectedClients
                    });
                }
            }

            socket.on('disconnect', () => {
                // Handle user disconnect, removing them from the lobby if necessary
                for (const lobbyId in lobbies) {
                    const lobby = lobbies[lobbyId];
                    const userIndex = lobby.connectedClients.findIndex(client => client.username === username);
                    if (userIndex !== -1) {
                        lobby.connectedClients.splice(userIndex, 1);
                        delete lobby.storeObj[username];

                        // Notify others in the lobby about the disconnection
                        io.to(lobbyId).emit('lobbyOperation', {
                            lobbyId: lobbyId,
                            lobbyStatus: "updated",
                            clients: lobby.connectedClients
                        });

                        // Optionally, clean up the lobby if no users are left
                        if (lobby.connectedClients.length === 0) {
                            delete lobbies[lobbyId];
                        }
                        console.log("after disconnect", lobby.connectedClients);

                        break;
                    }
                }
            });

            if (options.action === "fetch") {
                if (clients?.size && clients?.size > 0) {
                    io.emit('lobbyOperation', {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "alive",
                        clients: lobbies[lobbyId].connectedClients
                    });
                }

                console.warn(`[FETCH FAILED] Client denied fetch.`);
                return false;
            }

            if (options.action === "ready") {
                lobbies[lobbyId].connectedClients = lobbies[lobbyId].connectedClients.map(client => {
                    if (client.username === username) {
                        client.isReady = !client.isReady
                    }

                    return client;
                })

                if (clients?.size && clients?.size > 0) {
                    const readyClients = lobbies[lobbyId].connectedClients.filter(client => client.isReady)
                    if (readyClients.length === lobbies[lobbyId].connectedClients.length) {
                        io.emit("lobbyOperation", {
                            lobbyId: options.lobbyId,
                            lobbyStatus: "game",
                            clients: lobbies[lobbyId].connectedClients
                        })
                        const randNum = randomIntFromInterval(0, lobbies[lobbyId].connectedClients.length - 1);
                        let copUsername = ""
                        lobbies[lobbyId].connectedClients = lobbies[lobbyId].connectedClients.map((client, i) => {
                            if (randNum === i) {
                                client.isDetective = true;
                                copUsername = client.username
                            }
                            return client;
                        })

                        await context.entities.Lobby.update({
                            where: {
                                roomId: options.lobbyId,
                            },
                            data: {
                                lobbyState: "game",
                                detectiveId: copUsername
                            }
                        })
                    } else {
                        io.emit("lobbyOperation", {
                            lobbyId: options.lobbyId,
                            lobbyStatus: "alive",
                            clients: lobbies[lobbyId].connectedClients
                        })
                    }
                }
            }
        })

        socket.on('chatMessage', async (msgInfo) => {
            try {
                if (!msgInfo || !msgInfo.to || !msgInfo.msg || !msgInfo.msgContext) {
                    console.log(msgInfo);
                    throw new Error("Invalid message information.");
                }

                const sender = username;
                const recipient = msgInfo.to;
                const message = {
                    id: uuidv4(),
                    username: sender,
                    text: msgInfo.msg,
                    to: recipient
                };

                io.emit("chatMessage", { ...message, context: msgInfo.msgContext, isRobot: msgInfo.isRobot })
            } catch (error) {
                console.error("Error handling chatMessage event:", error);
            }
        });
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

interface ServerToClientEvents {
    chatMessage: (msg: {
        id: string, username: string, context: string, text: string, isRobot: boolean
    }) => void;
    lobbyOperation: (serverLobbyInfo: {
        lobbyId: string, lobbyStatus: string, clients: {
            username: string;
            isReady: boolean;
            isDetective: boolean;
            isRobot: boolean;
        }[]
    }) => void;
}

interface ClientToServerEvents {
    chatMessage: (msgInfo: { msgContext: string, msg: string, to: string, isRobot: boolean }) => void;
    lobbyOperation: (lobbyOptions: { action: string, lobbyId: string }) => void;
}

interface InterServerEvents { }

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData { }

// Utility function to remove duplicates in connectedClients array
function removeDuplicateClients(clients: any[]) {
    const uniqueClients: any[] = [];
    const usernames = new Set();

    clients.forEach(client => {
        if (!usernames.has(client.username)) {
            usernames.add(client.username);
            uniqueClients.push(client);
        }
    });

    return uniqueClients;
}