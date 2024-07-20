import React, { useEffect, useState } from 'react'
import { RouteComponentProps, useParams } from 'react-router-dom';
import { getUserLobby, joinLobby } from 'wasp/client/operations';
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'

export const JoinLobbyPage = (props: RouteComponentProps<{ joinCode: string }>) => {
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()

    useEffect(() => {
        let isCancelled = false;

        const handleGetUserLobby = async () => {
            try {
                const lobby = await getUserLobby();
                if (!isCancelled) {
                    if (!lobby) {
                        const joinCode = props.match.params.joinCode;
                        socket.emit('lobbyOperation', { lobbyId: joinCode, action: "join" });
                        await joinLobby({ roomId: joinCode });
                    }

                    window.location.href = window.location.origin + "/lobby";
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
                </div>
            </div>
        </>
    )
}

export default JoinLobbyPage;