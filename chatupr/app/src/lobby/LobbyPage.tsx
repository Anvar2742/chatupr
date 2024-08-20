import React, { useEffect, useState } from 'react'
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'
import { generateLobbyId } from './utils';
import { createLobby, getUserLobby, joinLobby } from 'wasp/client/operations'
import { AuthUser } from 'wasp/auth';
import { Lobby } from 'wasp/entities';
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { useHistory } from 'react-router-dom';

export const LobbyPage = ({ user }: { user: AuthUser }) => {
    const history = useHistory();
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()

    const [lobbyInfo, setLobbyInfo] = useState<Lobby>()
    const [lobbyMembers, setLobbyMembers] = useState<{ username: string; isReady: boolean; }[]>()
    // This is a type-safe event handler: "chatMessage" event and its payload type
    // are defined on the server.
    useSocketListener('lobbyOperation', updateLobbyInfo)

    function updateLobbyInfo(serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) {
        setLobbyMembers(serverLobbyInfo.clients);
    }


    useEffect(() => {
        let isCancelled = false;

        const handleLobbyOperations = async () => {
            try {
                const lobby = await getUserLobby();
                if (!isCancelled) {

                    if (lobby) {
                        if (!lobby.roomId) return
                        console.log(lobby);


                        socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: "join" });
                        await joinLobby({ roomId: lobby.roomId });
                        setLobbyInfo(lobby);
                    } else {
                        const newLobbyId = generateLobbyId(5);
                        socket.emit('lobbyOperation', { lobbyId: newLobbyId, action: "join" });
                        // TODO: move this to websocket.ts
                        await createLobby({ roomId: newLobbyId });
                        const newLobby = await getUserLobby();
                        setLobbyInfo(newLobby);
                    }
                }
            } catch (err: any) {
                if (!isCancelled) {
                    window.alert('Error: ' + (err.message || 'Something went wrong'));
                }
            }
        };

        if (isConnected) {
            handleLobbyOperations();
        }

        return () => {
            isCancelled = true;
        };
    }, [socket, isConnected]);

    useEffect(() => {
        if (lobbyMembers?.length) {
            const readyMembers = lobbyMembers.filter((member) => member.isReady)
            if (readyMembers.length === lobbyMembers.length) {
                history.push("/chat")
            }
        }
    }, [lobbyMembers])

    const updateReadyState = () => {
        if (!lobbyInfo?.roomId) return;
        socket.emit('lobbyOperation', { lobbyId: lobbyInfo?.roomId, action: "ready" });
    }

    const leaveLobby = () => {
        console.log("leaving");

        if (!lobbyInfo?.roomId) return;
        socket.emit('lobbyOperation', { lobbyId: lobbyInfo?.roomId, action: "leave" });
        history.push("/")
    }

    const connectionIcon = isConnected ? '🟢' : '🔴'

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h1 className='text-6xl font-bold text-center mb-10'>Welcome to Chat UPR!</h1>
                    <p className='text-lg bg-white p-4 fixed bottom-0 right-0 border shadow-2xl shadow-black'>
                        <span>Your connection: {connectionIcon}</span>
                        <button onClick={leaveLobby} className='mt-2 p-2 bg-red-500 text-white rounded'>Leave</button>
                    </p>
                    <h2 className='text-lg font-bold'>Lobby ID: {lobbyInfo?.roomId}</h2>
                    <h3>Invite your friends: {window.location.origin}/join/{lobbyInfo?.roomId}</h3>

                    <h2 className='text-4xl font-bold my-10'>Players:</h2>
                    <div className='max-w-lg grid gap-4'>
                        {lobbyMembers?.map(member => {
                            return (
                                <div className='flex items-center justify-between w-full' key={member.username}>
                                    <div>
                                        <img src={avatarPlaceholder} alt="" className='w-25' />
                                    </div>
                                    <div>
                                        <p>{member.username}</p>
                                        <p>{member.isReady ? "ready" : "not ready"}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <button onClick={updateReadyState} className='mt-2 p-2 bg-green-500 text-white rounded'>Ready</button>
                </div>
            </div>
        </>
    )
}

export default LobbyPage;