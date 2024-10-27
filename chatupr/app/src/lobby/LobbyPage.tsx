import React, { useEffect, useState } from 'react'
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
} from 'wasp/client/webSocket'
import { generateLobbyId } from './utils';
import { createLobby, getUserLobby, getUserLobbySession, joinLobby } from 'wasp/client/operations'
import { AuthUser } from 'wasp/auth';
import { Lobby } from 'wasp/entities';
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { useHistory } from 'react-router-dom';
import { useLobby } from './useLobby';

export const LobbyPage = ({ user }: { user: AuthUser }) => {
    const history = useHistory();
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()
    const [isCopy, setIsCopy] = useState<boolean>(false)
    const [lobbyMembers, setLobbyMembers] = useState<{ username: string; isReady: boolean; isConnected: boolean; }[]>()
    // This is a type-safe event handler: "chatMessage" event and its payload type
    // are defined on the server.
    useSocketListener('lobbyOperation', updateLobbyInfo)


    function updateLobbyInfo(serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) {
        console.log(serverLobbyInfo);

        if (serverLobbyInfo.lobbyStatus === "dead") history.push("/")
        setLobbyMembers(serverLobbyInfo.clients);
    }

    const { lobbyInfo, updateReadyState, leaveLobby } = useLobby(user, isConnected, socket);


    useEffect(() => {
        if (lobbyMembers?.length) {
            const readyMembers = lobbyMembers.filter((member) => member.isReady)
            if (readyMembers.length === lobbyMembers.length) {
                history.push("/chat")
            }
        }
    }, [lobbyMembers])

    const connectionIcon = isConnected ? '🟢' : '🔴'

    const copyInvite = () => {
        navigator.clipboard.writeText(`${window.location.origin}/join/${lobbyInfo?.roomId}`)
        setIsCopy(true)
        setTimeout(() => {
            setIsCopy(false)
        }, 1000);
    }

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
                    <h3>Invite your friends:</h3>
                    {lobbyInfo ? <p>
                        {window.location.origin}/join/{lobbyInfo?.roomId}
                        <button className={`mt-2 p-2 bg-blue-200 ml-5 rounded ${isCopy ? "bg-green-600" : ""}`} onClick={copyInvite}>{isCopy ? "Copied" : "Copy"}</button>
                    </p> : ""}

                    <h2 className='text-4xl font-bold my-10'>Players:</h2>
                    <div className='max-w-lg grid gap-4'>
                        {lobbyMembers?.map(member => {
                            const isReady = member.isReady;
                            const isCurrentUser = member.username === user.username
                            return (
                                <div className='flex items-center justify-between w-full' key={member.username}>
                                    <div>
                                        <img src={avatarPlaceholder} alt="" className='w-25' />
                                    </div>
                                    <div>
                                        <p>{member.username}</p>
                                        {/* <p>{member.isReady ? "ready" : "not ready"}</p> */}
                                        <p>{member.isConnected ? '🟢' : '🔴'}</p>
                                    </div>
                                    {isCurrentUser ? <button onClick={updateReadyState} className={`mt-2 p-2 text-white rounded capitalize ${isReady ? "bg-green-500" : "bg-red-500"}`}>{isReady ? "ready" : "not ready"}</button> : <p>{isReady ? "ready" : "not ready"}</p>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}

export default LobbyPage;