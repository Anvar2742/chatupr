import { createLobby } from 'wasp/server/operations';
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket'

export const webSocketFn: WebSocketFn = (io, context) => {

    io.on('connection', (socket) => {
        if (!socket.data.user) return;

        const username = socket.data.user.getFirstProviderUserId() ?? 'Unknown'
        console.log('a user connected: ', username)

        socket.on('lobbyOperation', async (options) => {
            if (!socket.data.user) return;
            if (!options.lobbyId) return;
            const clients = io.sockets.adapter.rooms.get(options.lobbyId);
            let storeObj = [];

            if (options.action === 'create') {
                // Check if lobby size is equal to zero
                //     If yes, create new lobby and join socket to the lobby
                //     If not, emit 'invalid operation: lobby already exists'

                if (clients?.size === 0 || !clients) {
                    await socket.join(options.lobbyId);
                    storeObj.push({ id: socket.id, username, isReady: false })

                    console.info(`[CREATE] Client created and joined lobby ${options.lobbyId}`);
                    // io.emit('lobbyOperation', {
                    //     lobbyId: options.lobbyId,
                    //     lobbyStatus: "alive",
                    //     clients: storeObj
                    // }); c

                    console.log("creating lobby")
                    // await createLobby({ name: options.lobbyId }, { user: socket.data.user });

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
                    storeObj.push({ id: socket.id, username, isReady: false })

                    console.info(`[JOIN] Client joined lobby ${options.lobbyId}`);
                    // io.emit('lobbyOperation', {
                    //     lobbyId: options.lobbyId,
                    //     lobbyStatus: "alive",
                    //     clients: storeObj
                    // });
                    return true;
                }

                console.warn(`[JOIN FAILED] Client denied join.`);
                return false;
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
    chatMessage: (msg: { id: string, username: string, text: string }) => void;
    lobbyOperation: (lobbyInfo: {
        lobbyId: string, lobbyStatus: string, clients: {
            id: string;
            username: string;
            isReady: boolean;
        }[]
    }) => void;
}

interface ClientToServerEvents {
    chatMessage: (msg: string) => void;
    lobbyOperation: (lobbyOptions: { action: string, lobbyId: string }) => void;
}

interface InterServerEvents { }

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData { }