import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { generateGptResponse, getUserLobby } from 'wasp/client/operations';
import avatarPlaceholder from '../client/static/avatar-placeholder.png';
import { AuthUser } from 'wasp/auth';
import { GptResponse, Lobby } from 'wasp/entities';
import { GeneratedResponse } from './utils';
import { useHistory } from 'react-router-dom';

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
    const [lobbyInfo, setLobbyInfo] = useState<Lobby>()
    const history = useHistory();

    // Listen for lobby updates
    useSocketListener('lobbyOperation', useCallback((serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) => {
        if (serverLobbyInfo.lobbyStatus === "dead") {
            localStorage.removeItem("chatMessages");
            history.push("/")
        }

        const detective = serverLobbyInfo.clients.find(member => member.isDetective);
        setDetectiveUser(detective);
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
                    setLobbyInfo(lobby);
                } else {
                    history.push("/")
                }
            } catch (err: any) {
                window.alert('Error: ' + (err.message || 'Something went wrong'));
            }
        };

        if (isConnected) {
            handleGetUserLobby();
        }
    }, [socket, isConnected]);



    const leaveLobby = () => {
        if (!lobbyInfo?.roomId) return;

        socket.emit('lobbyOperation', { lobbyId: lobbyInfo?.roomId, action: "leave" });
        localStorage.removeItem("chatMessages");
        history.push("/")
    }

    const connectionIcon = isConnected ? '🟢' : '🔴'

    // ChatBox component
    const ChatBox = useMemo(() => React.memo(({ user, member, currentUserIsDetective, propsDetectiveUser }: { user: AuthUser, member: Member, currentUserIsDetective: boolean, propsDetectiveUser: Member | undefined }) => {
        const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>(() => {
            const storedMessages = localStorage.getItem("chatMessages");
            return storedMessages ? JSON.parse(storedMessages) : [];
        });
        const [inputValue, setInputValue] = useState("");
        const chatContext = [user.username, member.username].sort().join('-')
        useEffect(() => {
            console.log(messages);

        }, [messages]);
        const [filteredMsgs, setFilteredMsgs] = useState<ServerToClientPayload<'chatMessage'>[]>();

        const getGptResponse = async (msgVal: string) => {
            const gptResponse = await generateGptResponse({ msg: msgVal });
            if (gptResponse.msg.trim() === "") return;
            socket.emit('chatMessage', {
                msgContext: gptResponse.context,
                msg: gptResponse.msg,
                to: gptResponse.sender,
                isRobot: true
            });
        }

        useEffect(() => {
            const handleMessage = (msg: ServerToClientPayload<'chatMessage'>) => {
                console.log(msg);

                setMessages((prevMessages) => {
                    const updatedMessages = [msg, ...prevMessages];
                    localStorage.setItem("chatMessages", JSON.stringify(updatedMessages));
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

            socket.emit('chatMessage', {
                msgContext: chatContext,
                msg: inputValue,
                to: member.username,
                isRobot
            });

            if (isRobot) {
                setTimeout(() => {
                    getGptResponse(inputValue);
                }, 1000);
            }

            setInputValue("");
        };

        useEffect(() => {
            setFilteredMsgs(() => {
                if (!currentUserIsDetective && !member.isDetective) {
                    return messages.filter(el => el.context === [propsDetectiveUser?.username, member.username].sort().join('-'))
                }
                return messages.filter(el => el.context === chatContext)
            })
        }, [messages])

        return (
            <div className='border border-black-2 p-4 mb-4'>
                <div>
                    <img src={avatarPlaceholder} alt="" className='w-25 mb-2' />
                    <p><strong>{member.username}</strong> {member.isDetective ? "🕵️" : "🐇"}</p>
                </div>
                <ul>
                    {filteredMsgs?.map((msg, index) => (
                        <li key={msg.id || index}>
                            {/* <em>{msg.username}</em>:  */}
                            {msg.text}
                        </li>
                    ))}
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
                <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                <h3>{lobbyInfo?.roomId}</h3>
                <p className='text-lg bg-white p-4 fixed bottom-0 right-0 border shadow-2xl shadow-black'>
                    <span>Your connection: {connectionIcon}</span>
                    <button onClick={leaveLobby} className='mt-2 p-2 bg-red-500 text-white rounded'>Leave</button>
                </p>
                <div className='max-w-lg grid gap-4'>
                    {
                        lobbyMembers?.map(member => (
                            member.username === user.username ? "" : <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} propsDetectiveUser={detectiveUser} />
                        ))
                    }
                </div>
            </div>
        </div>
    );
}

export default GamePage;
