import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid'
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket'

export const webSocketFn: WebSocketFn = (io, context) => {
    interface socketUser { socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>; }
    let storeObj: Record<string, socketUser> = {};
    let connectedClients: { username: string; isReady: boolean; }[] = []

    io.on('connection', (socket) => {
        if (!socket.data.user) return;

        const username = socket.data.user.getFirstProviderUserId() ?? "-1"
        if (username === "-1") return;

        console.log('a user connected: ', username)

        socket.on('lobbyOperation', async (options) => {
            if (!socket.data.user) return;
            if (!options.lobbyId) return;
            const clients = io.sockets.adapter.rooms.get(options.lobbyId);

            if (options.action === 'create') {
                // Check if lobby size is equal to zero
                //     If yes, create new lobby and join socket to the lobby
                //     If not, emit 'invalid operation: lobby already exists'

                if (clients?.size === 0 || !clients) {
                    await socket.join(options.lobbyId);
                    storeObj[username] = { socket: socket }
                    connectedClients.push({ username, isReady: false })
                    console.info(`[CREATE] Client created and joined lobby ${options.lobbyId}`);
                    console.log("creating lobby")
                    // await createLobby({ name: options.lobbyId }, { user: socket.data.user });
                    io.emit('lobbyOperation', {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "alive",
                        clients: connectedClients
                    });

                    return true;
                }

                console.warn(`[CREATE FAILED] Client denied create, as lobbyId ${options.lobbyId} already present`);
                return false;
            }

            if (options.action === "join") {
                // Check if lobby size is equal to or more than 1
                //     If yes, join the socket to the lobby
                //     If not, emit 'invalid operation: lobby does not exist'
                console.log(clients?.size);

                if (clients?.size && clients?.size > 0) {
                    await socket.join(options.lobbyId);
                    storeObj[username] = { socket: socket }
                    connectedClients.push({ username, isReady: false })

                    console.info(`[JOIN] Client joined lobby ${options.lobbyId}`);
                    // console.log(storeObj);

                    io.emit('lobbyOperation', {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "alive",
                        clients: connectedClients
                    });
                    return true;
                }

                console.warn(`[JOIN FAILED] Client denied join.`);
                return false;
            }

            if (options.action === "fetch") {
                if (clients?.size && clients?.size > 0) {
                    io.emit('lobbyOperation', {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "alive",
                        clients: connectedClients
                    });
                }

                console.warn(`[JOIN FAILED] Client denied join.`);
                return false;
            }

            if (options.action === "ready") {
                connectedClients = connectedClients.map(client => {
                    if (client.username === username) {
                        client.isReady = !client.isReady
                    }

                    return client;
                })

                if (clients?.size && clients?.size > 0) {
                    io.emit("lobbyOperation", {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "alive",
                        clients: connectedClients
                    })
                    // await context.entities.Lobby.update({
                    //     where: {
                    //         roomId: options.lobbyId,
                    //     },
                    //     data: {
                    //         members: {
                    //             update: {
                    //                 where: {
                    //                     username,
                    //                 },
                    //                 data: {
                                        
                    //                 }
                    //             }
                    //         }
                    //     },
                    // })
                }
            }
        })

        socket.on('chatMessage', async (msgInfo) => {
            try {
                // Validate msgInfo
                if (!msgInfo || !msgInfo.to || !msgInfo.msg) {
                    console.log(msgInfo);

                    throw new Error("Invalid message information.");
                }

                // Define the recipients
                const recipients = [msgInfo.to, username];
                const message = {
                    id: uuidv4(),
                    username,
                    text: msgInfo.msg
                };

                // Send the message to each recipient
                recipients.forEach((recipient) => {
                    if (storeObj[recipient] && storeObj[recipient].socket) {
                        storeObj[recipient].socket.emit("chatMessage", message);
                    } else {
                        console.warn(`Recipient ${recipient} not found or not connected.`);
                    }
                });
            } catch (error) {
                console.error("Error handling chatMessage event:", error);
            }
        });

        socket.on("disconnect", async () => {
            try {
                for (let i = 0; i < connectedClients.length; i++) {
                    const el = connectedClients[i];
                    if (el.username === username) {
                        connectedClients.splice(i, 1)
                    }
                }
            } catch (error) {
                console.error("Error handling disconnect event:", error);
            }
        })
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
        id: string, username: string, text: string
    }) => void;
    lobbyOperation: (serverLobbyInfo: {
        lobbyId: string, lobbyStatus: string, clients: {
            username: string;
            isReady: boolean;
        }[]
    }) => void;
}

interface ClientToServerEvents {
    chatMessage: (msgInfo: { msg: string, to: string }) => void;
    lobbyOperation: (lobbyOptions: { action: string, lobbyId: string }) => void;
}

interface InterServerEvents { }

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData { }