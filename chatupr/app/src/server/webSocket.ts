import { getFirstProviderUserId } from 'wasp/auth'
import { type WebSocketDefinition, type WaspSocketData } from 'wasp/server/webSocket'

export const webSocketFn: WebSocketFn = (io, context) => {

    io.on('connection', (socket) => {
        if (!socket.data.user) return;

        const username = socket.data.user.getFirstProviderUserId() ?? 'Unknown'
        console.log('a user connected: ', username)

        socket.on('roomOperation', async (options) => {
            if (!options.roomId) return;
            const clients = io.sockets.adapter.rooms.get(options.roomId);
            let storeObj = [];

            if (options.action === 'create') {
                // Check if room size is equal to zero
                //     If yes, create new room and join socket to the room
                //     If not, emit 'invalid operation: room already exists'

                if (clients?.size === 0 || !clients) {
                    await socket.join(options.roomId);
                    storeObj.push({ id: socket.id, username, isReady: false })

                    console.info(`[CREATE] Client created and joined room ${options.roomId}`);
                    io.emit('roomOperation', {
                        roomId: options.roomId,
                        roomStatus: "alive",
                        clients: storeObj
                    });

                    return true;
                }

                console.warn(`[CREATE FAILED] Client denied create, as roomId ${options.roomId} already present`);
                return false;
            }

            if (options.action === "join") {
                // Check if room size is equal to or more than 1
                //     If yes, join the socket to the room
                //     If not, emit 'invalid operation: room does not exist'
                if (clients?.size && clients?.size > 0) {
                    await socket.join(options.roomId);
                    storeObj.push({ id: socket.id, username, isReady: false })

                    console.info(`[JOIN] Client joined room ${options.roomId}`);
                    io.emit('roomOperation', {
                        roomId: options.roomId,
                        roomStatus: "alive",
                        clients: storeObj
                    });
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
    roomOperation: (roomInfo: {
        roomId: string, roomStatus: string, clients: {
            id: string;
            username: string;
            isReady: boolean;
        }[]
    }) => void;
}

interface ClientToServerEvents {
    chatMessage: (msg: string) => void;
    roomOperation: (roomOptions: { action: string, roomId: string }) => void;
}

interface InterServerEvents { }

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData { }