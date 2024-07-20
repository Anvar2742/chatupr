import React, { useEffect, useState } from 'react'
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'
import { generateLobbyId } from './utils';
import { createLobby, getUserLobby } from 'wasp/client/operations'

export const LobbyPage = () => {
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()

    const [lobbyInfo, setLobbyInfo] = useState<{ lobbyId: string }>({ lobbyId: "" })

    useEffect(() => {
        let isCancelled = false;

        const handleGetUserLobby = async () => {
            try {
                const lobby = await getUserLobby();
                if (!isCancelled) {
                    if (lobby) {
                        if (!lobby.roomId) return
                        setLobbyInfo({ lobbyId: lobby.roomId });
                    } else {
                        const newLobbyId = generateLobbyId(5);
                        setLobbyInfo({ lobbyId: newLobbyId });
                        socket.emit('lobbyOperation', { lobbyId: newLobbyId, action: "create" });
                        await createLobby({ roomId: newLobbyId });
                    }
                }
            } catch (err: any) {
                if (!isCancelled) {
                    window.alert('Error: ' + (err.message || 'Something went wrong'));
                }
            }
        };

        if (isConnected) {
            handleGetUserLobby();
        }

        return () => {
            isCancelled = true;
        };
    }, [socket, isConnected]);

    const connectionIcon = isConnected ? '🟢' : '🔴'

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h2>Connection: {connectionIcon}</h2>
                    <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                    <h2 className='text-lg font-bold'>Lobby ID: {lobbyInfo.lobbyId}</h2>
                    <h3>Invite your friends: {window.location.origin}/join/{lobbyInfo.lobbyId}</h3>
                </div>
            </div>
        </>
    )
}

export default LobbyPage;