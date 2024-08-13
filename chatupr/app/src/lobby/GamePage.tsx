import React, { useEffect, useState } from 'react'
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'
import { getUserLobby } from 'wasp/client/operations'
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { AuthUser } from 'wasp/auth';

export const GamePage = ({ user }: { user: AuthUser }) => {
    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()

    const [lobbyInfo, setLobbyInfo] = useState<{ lobbyId: string }>({ lobbyId: "" })
    const [lobbyMembers, setLobbyMembers] = useState<{ username: string; isReady: boolean; isDetective: boolean }[]>()
    const [detectiveUser, setDetectiveUser] = useState<{ username: string; isReady: boolean; isDetective: boolean }>();

    const [currentChatContext, setCurrentChatContext] = useState<string>("");
    const [msgOptions, setMsgOptions] = useState<
        // We are using a helper type to get the payload type for the "chatMessage" event.
        ClientToServerPayload<'chatMessage'>
    >({ msg: "", to: "" })
    const [messages, setMessages] = useState<
        ServerToClientPayload<'chatMessage'>[]
    >([])

    useSocketListener('lobbyOperation', updateLobbyInfo)

    function updateLobbyInfo(serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) {
        setLobbyInfo(serverLobbyInfo);
        setLobbyMembers(serverLobbyInfo.clients)
    }

    useEffect(() => {
        if (lobbyMembers?.length) {
            setDetectiveUser(lobbyMembers?.filter(el => el.isDetective)[0])
            setCurrentChatContext([user.username, msgOptions.to].sort().join('-')); // Set the chat context
        }
    }, [lobbyMembers])

    useEffect(() => {
        if (detectiveUser) {
            if (!(detectiveUser.username === user.username)) {
                setMsgOptions(msgPrior => ({ msg: msgPrior.msg, to: detectiveUser.username }))
            }
        }
    }, [detectiveUser])

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
                    if (lobby) {
                        if (!lobby.roomId) return
                        console.log("game started join lobby");

                        socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: "join" });
                        setLobbyInfo({ lobbyId: lobby.roomId });
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

    // useEffect(() => {
    //     console.log(msgOptions);
    // }, [msgOptions])

    // This is a type-safe event handler: "chatMessage" event and its payload type
    // are defined on the server.
    useSocketListener('chatMessage', logMessage)

    function logMessage(msg: ServerToClientPayload<'chatMessage'>) {
        setMessages((priorMessages) => [msg, ...priorMessages])
    }

    useEffect(() => {
        console.log(messages);
    }, [messages])

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        console.log(msgOptions);


        socket.emit('chatMessage', { msg: msgOptions.msg, to: msgOptions.to });

        setMsgOptions(msgPrior => ({ msg: "", to: msgPrior.to }));
    }

    const connectionIcon = isConnected ? '🟢' : '🔴'

    const handleRecipient = (e: any, member: { username: string; isDetective: boolean; }) => {
        if (member.username === user.username) return;
        if (!(detectiveUser?.username === user.username)) return;
        let recipient = member.username;

        setMsgOptions((msgPrior: { msg: any; }) => {
            return { msg: msgPrior.msg, to: recipient }
        })
    }

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h2>Connection: {connectionIcon}</h2>
                    <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>

                    <div className='max-w-lg grid gap-4'>
                        {lobbyMembers?.map(member => {
                            return (
                                <div className={`flex items-center justify-between w-full`} key={member.username}>
                                    <div>
                                        <img src={avatarPlaceholder} alt="" className='w-25' />
                                    </div>
                                    <div>
                                        <p>{member.username}</p>
                                        <p>{member.isDetective ? "🕵️" : "🐇"}</p>
                                    </div>
                                    <div className='border border-black-2'>
                                        {
                                            messages.filter(msg => msg.context === [detectiveUser?.username, member.username].sort().join('-')).map((msg) => (
                                                <li key={msg.id}>
                                                    <em>{msg.username}</em>: {msg.text}
                                                </li>
                                            ))
                                        }
                                        {
                                            (detectiveUser?.username === user.username || member.isDetective) && !(user.username === member.username) ? <form onSubmit={handleSubmit}>
                                                <div>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={msgOptions.msg}
                                                            onChange={(e) => setMsgOptions((msgPrior) => {
                                                                return { msg: e.target.value, to: member.username }
                                                            })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <button type="submit">Submit</button>
                                                    </div>
                                                </div>
                                            </form> : ""
                                        }
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}

export default GamePage;