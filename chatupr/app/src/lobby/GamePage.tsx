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

export const GamePage = ({ user }: { user: AuthUser }) => {
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()

    const [lobbyInfo, setLobbyInfo] = useState<{ lobbyId: string }>({ lobbyId: "" })

    const [msgOptions, setMsgOptions] = useState<
        // We are using a helper type to get the payload type for the "chatMessage" event.
        ClientToServerPayload<'chatMessage'>
    >({ msg: "", to: "anvarmusa12@gmail.com" })
    const [messages, setMessages] = useState<
        ServerToClientPayload<'chatMessage'>[]
    >([])

    /**
     * ChatWindows.tsx
     * 
     */

    useEffect(() => { 
        let isCancelled = false;

        const handleGetUserLobby = async () => {
            try {
                const lobby = await getUserLobby();
                if (!isCancelled) {
                    console.log(lobby);

                    if (lobby) {
                        if (!lobby.roomId) return
                        console.log(user.getFirstProviderUserId());
                        console.log(lobby.creatorId);

                        socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: lobby.creatorId === user.id ? "create" : "join" });
                        await joinLobby({ roomId: lobby.roomId });
                        setLobbyInfo({ lobbyId: lobby.roomId });
                    } else {
                        const newLobbyId = generateLobbyId(5);
                        setLobbyInfo({ lobbyId: newLobbyId });
                        socket.emit('lobbyOperation', { lobbyId: newLobbyId, action: "create" });
                        // TODO: move this to websocket.ts
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

    // This is a type-safe event handler: "chatMessage" event and its payload type
    // are defined on the server.
    useSocketListener('chatMessage', logMessage)

    function logMessage(msg: ServerToClientPayload<'chatMessage'>) {
        setMessages((priorMessages) => [msg, ...priorMessages])
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        // This is a type-safe event emitter: "chatMessage" event and its payload type
        // are defined on the server.
        socket.emit('chatMessage', { msg: msgOptions.msg, to: msgOptions.to })
        setMsgOptions({ msg: "", to: "anvarmusa12@gmail.com" })
    }

    const messageList = messages.map((msg) => (
        <li key={msg.id}>
            <em>{msg.username}</em>: {msg.text}
        </li>
    ))

    const connectionIcon = isConnected ? '🟢' : '🔴'

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h2>Connection: {connectionIcon}</h2>
                    <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                    <h2 className='text-lg font-bold'>Lobby ID: {lobbyInfo.lobbyId}</h2>
                    <h3>Invite your friends: {window.location.origin}/join/{lobbyInfo.lobbyId}</h3>

                    <form onSubmit={handleSubmit}>
                        <div>
                            <div>
                                <input
                                    type="text"
                                    value={msgOptions.msg}
                                    onChange={(e) => setMsgOptions((msgPrior) => {
                                        return { msg: e.target.value, to: msgPrior.to }
                                    })}
                                />
                            </div>
                            <div>
                                <button type="submit">Submit</button>
                            </div>
                        </div>
                    </form>
                    <ul>{messageList}</ul>
                </div>
            </div>
        </>
    )
}

export default GamePage;