import { randomIntFromInterval } from "../utils";

export const lobbyOperations = (socket: any, lobbies: any, io: any, context: any, username: string) => {
    socket.on('lobbyOperation', async (options: { lobbyId: any; action: string; }) => {
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

        /**
         * Leave
         */
        if (options.action === "leave") {
            if (!clients?.size || clients.size === 0) {
                console.error("No clients in the lobby or lobby doesn't exist");
                return;
            }

            const lobbyFromDb = await findLobbyWithMembers(lobbyId);
            if (!lobbyFromDb) return;

            const userId = socket.data.user?.id;
            if (!userId) {
                console.error("User not authenticated");
                return;
            }

            await removeUserFromLobby(userId, lobbyId, username, lobby, lobbyFromDb.creatorId);

            if (shouldDeleteLobby(userId, lobby, lobbyFromDb.creatorId)) {
                await deleteLobbyAndNotify(lobbyId);
            } else {
                notifyLobbyUpdate(lobbyId, lobby.connectedClients);
            }
        }

        async function findLobbyWithMembers(lobbyId: any) {
            try {
                return await context.entities.Lobby.findUnique({
                    where: { roomId: lobbyId },
                    include: { members: true }
                });
            } catch (error) {
                console.error("Lobby not found", error);
                return null;
            }
        }

        async function removeUserFromLobby(userId: any, lobbyId: any, username: string, lobby: { connectedClients: any[]; }, creatorId: any) {
            await context.entities.Lobby.update({
                where: { roomId: lobbyId },
                data: {
                    members: {
                        disconnect: { id: userId }
                    }
                }
            });

            await context.entities.LobbySession.delete({ where: { username } });

            // Remove the player from the lobby's connected clients
            const userIndex = lobby.connectedClients.findIndex((client: { username: any; }) => client.username === username);
            if (userIndex !== -1) {
                lobby.connectedClients.splice(userIndex, 1);
            }

            // Leave the socket room
            await socket.leave(lobbyId);
        }

        function shouldDeleteLobby(userId: any, lobby: { connectedClients: string | any[]; }, creatorId: any) {
            return creatorId === userId || lobby.connectedClients.length === 0;
        }

        async function deleteLobbyAndNotify(lobbyId: string | number) {
            await context.entities.Lobby.delete({ where: { roomId: lobbyId } });
            await context.entities.LobbyMessage.deleteMany({ where: { lobbyId } });
            await context.entities.LobbySession.deleteMany({ where: { lobbyId } });

            io.to(lobbyId).emit('lobbyOperation', {
                lobbyId,
                lobbyStatus: "dead",
                clients: []
            });

            // Optionally, clean up the in-memory lobby if no users are left
            delete lobbies[lobbyId];
        }

        function notifyLobbyUpdate(lobbyId: any, connectedClients: any) {
            io.to(lobbyId).emit('lobbyOperation', {
                lobbyId,
                lobbyStatus: "updated",
                clients: connectedClients
            });
        }
        /**
         * Leave region end
         */


        /**
         * Reconnect region
         */
        if (options.action === "reconnect") {
            await socket.join(lobbyId)
            const userIndex = lobby.connectedClients.findIndex((client: { username: string; }) => client.username === username);

            if (userIndex === -1) {
                const lobbySess = await context.entities.LobbySession.findUnique({ where: { username } })
                if (lobbySess === null) return;
                lobby.connectedClients.push({
                    username,
                    isReady: lobbySess.isReady,
                    isDetective: lobbySess.isDetective,
                    isRobot: false,
                    isConnected: true,
                    canPlay: lobbySess.canPlay,
                    isHost: lobbySess.isHost
                });
            } else {
                lobby.connectedClients[userIndex].isConnected = true;
            }
            
            const lobbyDb = await context.entities.Lobby.findUnique({ where: { roomId: lobbyId } })
            console.log(lobbyDb);
            io.to(lobbyId).emit('lobbyOperation', {
                lobbyId: lobbyId,
                lobbyStatus: lobbyDb.lobbyState,
                clients: lobby.connectedClients
            });

        }

        /**
         * Reconnect region end
         */


        /**
         * Join region
         */

        if (options.action === "join") {
            const isLobbyExisting = clients?.size && clients.size > 0;
            await socket.join(lobbyId);
            lobby.storeObj[username] = { socket };

            // If lobby doesn't exist, clear and reinitialize it
            if (!isLobbyExisting) {
                initializeNewLobby(username, lobbyId, lobby);
                return;
            }

            // Check if the user already exists in the database
            const existingUser = await context.entities.LobbySession.findUnique({ where: { username } });
            if (existingUser === null) {
                addUserToLobbyAndSession(username, lobbyId, lobby, false);
            }

            io.to(lobbyId).emit('lobbyOperation', {
                lobbyId,
                lobbyStatus: "alive",
                clients: lobby.connectedClients
            });
        }

        async function addUserToLobbyAndSession(username: string, lobbyId: string, lobby: any, isHost: boolean) {
            console.log("add user to lobby");

            lobby.connectedClients.push({
                username,
                isReady: false,
                isDetective: false,
                isRobot: false,
                isConnected: true,
                canPlay: true,
                isHost
            });

            const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
            const expiresAt = new Date(Date.now() + oneDayInMilliseconds);

            await context.entities.LobbySession.create({
                data: {
                    username,
                    isReady: false,
                    isDetective: false,
                    isHost,
                    lobbyId,
                    expiresAt,
                    canPlay: true
                }
            });
        }

        function initializeNewLobby(username: string, lobbyId: string, lobby: any) {
            lobby.connectedClients = [];
            addUserToLobbyAndSession(username, lobbyId, lobby, true);

            console.info(`[CREATE] Client created and joined lobby ${lobbyId}`);

            io.to(lobbyId).emit('lobbyOperation', {
                lobbyId,
                lobbyStatus: "alive",
                clients: lobby.connectedClients
            });
        }
        /**
         * Join region end
         */


        /**
         * Disconnect region
         */

        socket.on('disconnect', () => {
            // Handle user disconnect, removing them from the lobby if necessary
            for (const lobbyId in lobbies) {
                const userIndex = lobby.connectedClients.findIndex((client: { username: string; }) => client.username === username);
                if (userIndex !== -1) {
                    // just show that the user isn't in the lobby instead of removing 
                    lobby.connectedClients[userIndex].isConnected = false;
                    console.log("after disconnect", lobby.connectedClients);
                    io.to(lobbyId).emit('lobbyOperation', {
                        lobbyId: lobbyId,
                        lobbyStatus: "alive",
                        clients: lobby.connectedClients
                    });
                    break;
                }
            }
        });
        /**
         * Disconnect region end
         */



        /**
         * Fetch region
         */
        if (options.action === "fetch") {
            if (clients?.size && clients?.size > 0) {
                io.emit('lobbyOperation', {
                    lobbyId: options.lobbyId,
                    lobbyStatus: "alive",
                    clients: lobby.connectedClients
                });
            }

            console.warn(`[FETCH FAILED] Client denied fetch.`);
            return false;
        }
        /**
         * Fetch region
         */


        /**
         * Ready region
         */

        if (options.action === "ready") {
            lobby.connectedClients = lobby.connectedClients.map((client: { username: string; isReady: boolean; }) => {
                if (client.username === username) {
                    client.isReady = !client.isReady
                }

                return client;
            })

            const currentUserLobbySession = await context.entities.LobbySession.findUnique({ where: { username } });
            // Check if the user already exists in the database
            await context.entities.LobbySession.update({ where: { username }, data: { isReady: !currentUserLobbySession?.isReady } });

            if (clients?.size && clients?.size > 0) {
                const readyClients = lobby.connectedClients.filter((client: { isReady: any; }) => client.isReady)
                if (readyClients.length === lobby.connectedClients.length) {
                    io.emit("lobbyOperation", {
                        lobbyId: options.lobbyId,
                        lobbyStatus: "game",
                        clients: lobby.connectedClients
                    })

                    const randNum = randomIntFromInterval(0, lobby.connectedClients.length - 1);
                    let copUsername = lobby.connectedClients[randNum].username
                    lobby.connectedClients[randNum].isDetective = true

                    await context.entities.LobbySession.update({ where: { username: copUsername }, data: { isDetective: true } })
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
                        clients: lobby.connectedClients
                    })
                }
            }
        }
        /**
         * Ready region end
         */
    })
}