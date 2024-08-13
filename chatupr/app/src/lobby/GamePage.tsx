import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { generateGptResponse, getUserLobby } from 'wasp/client/operations';
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { AuthUser } from 'wasp/auth';
import { GptResponse } from 'wasp/entities';
import { GeneratedResponse } from './utils';

export const GamePage = ({ user }: { user: AuthUser }) => {
    type Member = {
        username: string;
        isReady: boolean;
        isDetective: boolean;
        isRobot: boolean;
    }
    const { socket, isConnected } = useSocket();
    const [lobbyMembers, setLobbyMembers] = useState<Member[]>([]);
    const [detectiveUser, setDetectiveUser] = useState<Member>();

    // Listen for lobby updates
    useSocketListener('lobbyOperation', useCallback((serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) => {
        console.log(serverLobbyInfo.clients);
        
        setLobbyMembers((prevMembers) => {
            return [...serverLobbyInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true }]
        });
    }, []));

    // Fetch initial lobby state
    useEffect(() => {
        const handleGetUserLobby = async () => {
            try {
                const lobby = await getUserLobby();
                if (lobby?.roomId) {
                    socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: 'join' });
                }
            } catch (err: any) {
                window.alert('Error: ' + (err.message || 'Something went wrong'));
            }
        };

        if (isConnected) {
            handleGetUserLobby();
        }
    }, [socket, isConnected]);

    // Set detective user
    useEffect(() => {        
        
        console.log(lobbyMembers);
        if (lobbyMembers.length > 0) {
            const detective = lobbyMembers.find(member => member.isDetective);
            setDetectiveUser(detective);
        }
    }, [lobbyMembers]);


    const connectionIcon = isConnected ? '🟢' : '🔴';

    // ChatBox component
    const ChatBox = useMemo(() => React.memo(({ user, member, currentUserIsDetective }: { user: AuthUser, member: Member, currentUserIsDetective: boolean }) => {
        const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>([]);
        const [gptMessages, setGptMessages] = useState<GeneratedResponse[]>([]);
        const [gptResponsesEls, setGptResponsesEls] = useState<React.JSX.Element[]>();
        const [inputValue, setInputValue] = useState("");
        const chatContext = [user.username, member.username].sort().join('-')
        useEffect(() => {
            console.log(messages);

        }, [messages]);

        useEffect(() => {
            const handleMessage = (msg: ServerToClientPayload<'chatMessage'>) => {
                setMessages((prevMessages) => {
                    const updatedMessages = [msg, ...prevMessages];
                    // localStorage.setItem(`chatMessages-${member.username}`, JSON.stringify(updatedMessages));
                    return updatedMessages;
                });
            };

            socket.on('chatMessage', handleMessage);


            return () => {
                socket.off('chatMessage', handleMessage);
            };
        }, [socket, chatContext]);

        const handleSubmit = (e: { preventDefault: () => void; }, isRobot: boolean) => {
            e.preventDefault();
            if (inputValue.trim() === "") return;
            const getGptResponse = async () => {
                const gptResponse = await generateGptResponse({ msg: inputValue });

                setGptMessages((prevMessages) => {
                    const updatedMessages = [gptResponse, ...prevMessages];
                    return updatedMessages;
                });
            }

            if (isRobot) {
                if (!inputValue) return;
                setGptMessages((prevMessages) => {
                    if (!user) return prevMessages;
                    const gptResponse = {
                        id: Math.random().toString(),
                        context: [detectiveUser?.username, "chatgpt"].sort().join('-'),
                        sender: user.username || "",
                        msg: inputValue
                    }
                    const updatedMessages = [gptResponse, ...prevMessages];
                    return updatedMessages;
                });
                getGptResponse();
            } else {
                socket.emit('chatMessage', {
                    msgContext: chatContext,
                    msg: inputValue,
                    to: member.username,
                });
            }

            setInputValue("");
        };

        let filteredMsgs = messages.filter(el => el.context === chatContext)
        if (!currentUserIsDetective && !member.isDetective) {
            filteredMsgs = messages.filter(el => el.context === [detectiveUser?.username, member.username].sort().join('-'))
            console.log([detectiveUser?.username, member.username].sort().join('-'));
        }

        useEffect(() => {
            setGptResponsesEls(() =>
                gptMessages.map((gptMsg, i) => (
                    <li key={gptMsg.id || i}>
                        {/* <em>{msg.username}</em>:  */}
                        {gptMsg.msg}
                    </li>
                ))
            );

        }, [gptMessages])

        return (
            <div className='border border-black-2 p-4 mb-4'>
                <div>
                    <img src={avatarPlaceholder} alt="" className='w-25 mb-2' />
                    {/* <p><strong>{member.username}</strong> {member.isDetective ? "🕵️" : "🐇"}</p> */}
                </div>
                <ul>
                    {!member.isRobot ? filteredMsgs.map((msg, index) => (
                        <li key={msg.id || index}>
                            {/* <em>{msg.username}</em>:  */}
                            {msg.text}
                        </li>
                    )) : gptResponsesEls}
                </ul>
                {(currentUserIsDetective || member.isDetective) && !(user.username === member.username) ? (
                    <form onSubmit={(e) => handleSubmit(e, member.isRobot)}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full p-2 mt-2 border rounded"
                        />
                        <button type="submit" className="mt-2 p-2 bg-blue-500 text-white rounded">
                            Send
                        </button>
                    </form>
                ) : null}
            </div>
        );
    }), []);

    return (
        <div className='py-32 lg:mt-10'>
            <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                <h2>Connection: {connectionIcon}</h2>
                <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                <div className='max-w-lg grid gap-4'>
                    {
                        lobbyMembers?.map(member => (
                            member.username === user.username ? "" : <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}

export default GamePage;
