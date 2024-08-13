import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { getUserLobby } from 'wasp/client/operations';
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { AuthUser } from 'wasp/auth';

export const GamePage = ({ user }: { user: AuthUser }) => {
    const { socket, isConnected } = useSocket();
    const [lobbyMembers, setLobbyMembers] = useState<{
        username: string;
        isReady: boolean;
        isDetective: boolean;
        isRobot: boolean;
    }[]>([]);
    const [detectiveUser, setDetectiveUser] = useState<{ username: string; isReady: boolean; isDetective: boolean }>();

    // Listen for lobby updates
    useSocketListener('lobbyOperation', useCallback((serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) => {
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
        if (lobbyMembers.length > 0) {
            const detective = lobbyMembers.find(member => member.isDetective);
            setDetectiveUser(detective);
        }
    }, [lobbyMembers]);

    const connectionIcon = isConnected ? '🟢' : '🔴';

    // ChatBox component
    const ChatBox = useMemo(() => React.memo(({ user, member, currentUserIsDetective }: { user: AuthUser, member: { username: string; isReady: boolean; isDetective: boolean }, currentUserIsDetective: boolean }) => {
        const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>([]);
        const [inputValue, setInputValue] = useState("");
        const chatContext = [user.username, member.username].sort().join('-');

        useEffect(() => {
            const handleMessage = (msg: ServerToClientPayload<'chatMessage'>) => {
                if (msg.context === chatContext) {
                    setMessages((prevMessages) => {
                        const updatedMessages = [msg, ...prevMessages];
                        // localStorage.setItem(`chatMessages-${member.username}`, JSON.stringify(updatedMessages));
                        return updatedMessages;
                    });
                }
            };

            socket.on('chatMessage', handleMessage);

            return () => {
                socket.off('chatMessage', handleMessage);
            };
        }, [socket, chatContext]);

        const handleSubmit = (e: { preventDefault: () => void; }) => {
            e.preventDefault();
            if (inputValue.trim() === "") return;

            socket.emit('chatMessage', {
                msgContext: chatContext,
                msg: inputValue,
                to: member.username,
            });

            setInputValue("");
        };

        return (
            <div className='border border-black-2 p-4 mb-4'>
                <div>
                    <img src={avatarPlaceholder} alt="" className='w-25 mb-2' />
                    <p><strong>{member.username}</strong> {member.isDetective ? "🕵️" : "🐇"}</p>
                </div>
                <ul>
                    {messages.filter(el => el.context === chatContext).map((msg, index) => (
                        <li key={msg.id || index}>
                            <em>{msg.username}</em>: {msg.text}
                        </li>
                    ))}
                </ul>
                {(currentUserIsDetective || member.isDetective) && !(user.username === member.username) ? (
                    <form onSubmit={handleSubmit}>
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
                            <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}

export default GamePage;
