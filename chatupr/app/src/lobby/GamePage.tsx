import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { generateGptResponse, getUserLobby } from 'wasp/client/operations';
import { AuthUser } from 'wasp/auth';
import { Lobby } from 'wasp/entities';
import { useHistory } from 'react-router-dom';
import { shuffle } from './utils';

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
            return shuffle([...serverLobbyInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true }])
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
    const ChatBox = useMemo(() => React.memo(({ user, member, currentUserIsDetective, propsDetectiveUser, index }: { user: AuthUser, member: Member, currentUserIsDetective: boolean, propsDetectiveUser: Member | undefined, index: number }) => {
        const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>(() => {
            const storedMessages = localStorage.getItem("chatMessages");
            const arr = storedMessages ? JSON.parse(storedMessages) : [];
            return arr.sort((a: { createdAt: number | Date; }, b: { createdAt: number | Date; }) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
        });
        const [inputValue, setInputValue] = useState("");
        const chatContext = [user.username, member.username].sort().join('-')
        const [filteredMsgs, setFilteredMsgs] = useState<ServerToClientPayload<'chatMessage'>[]>();

        const getGptResponse = async (msgVal: string) => {
            const gptResponse = await generateGptResponse({ msg: msgVal });
            let gptTimeOut = 2000
            const min = 50
            const max = 100
            for (let i = 0; i < gptResponse.msg.length; i++) {
                gptTimeOut += Math.random() * (max - min) + min
            }

            setTimeout(() => {
                if (gptResponse.msg.trim() === "") return;
                socket.emit('chatMessage', {
                    msgContext: gptResponse.context,
                    msg: gptResponse.msg,
                    to: gptResponse.sender,
                    isRobot: true,
                    createdAt: Date.now()
                });
            }, gptTimeOut);
        }

        useEffect(() => {
            const handleMessage = (msg: ServerToClientPayload<'chatMessage'>) => {
                setMessages((prevMessages) => {
                    const updatedMessages = [msg, ...prevMessages];
                    localStorage.setItem("chatMessages", JSON.stringify(updatedMessages));
                    return updatedMessages.sort((a: { createdAt: number | Date; }, b: { createdAt: number | Date; }) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());;
                });
            };

            socket.on('chatMessage', handleMessage);

            return () => {
                socket.off('chatMessage', handleMessage);
            };
        }, [socket, chatContext]);

        const handleSubmit = (e: { preventDefault: () => void; }, isRobot: boolean, isMyTurn: boolean) => {
            e.preventDefault();
            if (!isMyTurn) {
                window.alert("Not your turn!");
                return;
            }
            if (inputValue.trim() === "") return;

            socket.emit('chatMessage', {
                msgContext: chatContext,
                msg: inputValue,
                to: member.username,
                isRobot: false,
                createdAt: Date.now()
            });

            if (isRobot) {
                let gptTimeOut = 2000
                const min = 100
                const max = 500
                for (let i = 0; i < inputValue.length; i++) {
                    gptTimeOut += Math.random() * (max - min) + min
                }

                setTimeout(() => {
                    getGptResponse(inputValue);
                }, gptTimeOut);
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

        if (!filteredMsgs) return

        return (
            <div className='border border-black-2 p-4 mb-4'>

                {/* <div>
                    <img src={avatarPlaceholder} alt="" className='w-25 mb-2' />
                    <p><strong>{member.username}</strong> {member.isDetective ? "🕵️" : "🐇"}</p>
                </div> */}
                <h3 className='font-bold text-4xl'>{index}</h3>
                <div className='border-black border-solid border p-5 shadow-2 shadow-slate-500 rounded-xl mt-10'>
                    <ul className=''>
                        {filteredMsgs?.map((msg, index) => (
                            <li key={msg.id || index} className={`
                            mb-2    
                            ${msg.username === user.username
                                    ? "text-right" // Current user sending a message
                                    : msg.username === propsDetectiveUser?.username && msg.to != user.username
                                        ? "text-right" // Detective's message and it isn't addressed to the current user
                                        : "" // Everyone else's message
                                }`}>
                                {/* <em>{msg.username}</em>: */}
                                <span className={`
                                    py-1 px-4 rounded
                                    ${msg.username === user.username
                                        ? "bg-orange-300" // Current user sending a message
                                        : msg.username === propsDetectiveUser?.username && msg.to != user.username
                                            ? "bg-orange-300" // Detective's message and it isn't addressed to the current user
                                            : "bg-blue-300" // Everyone else's message
                                    }`}
                                >{msg.text}</span>
                            </li>
                        ))}
                    </ul>
                    {(currentUserIsDetective || member.isDetective) && !(user.username === member.username) ? (
                        <form onSubmit={(e) => handleSubmit(e, member.isRobot, filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].username === user.username ? false : true : user.username === propsDetectiveUser?.username ? true : false)}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="w-full p-2 mt-2 border rounded"
                            />
                            <button type="submit" className={`mt-2 p-2 text-white rounded ${filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].username === user.username ? "bg-gray-400 pointer-events-none" : "bg-blue-500" : user.username === propsDetectiveUser?.username ? "bg-blue-500" : "bg-gray-400 pointer-events-none"}`}>
                                {filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].username === user.username ? "Не твоя очередь" : "Отправить" : user.username === propsDetectiveUser?.username ? "Отправить" : "Не твоя очередь"}
                            </button>
                        </form>
                    ) : null}
                </div>
            </div>
        );
    }), []);

    let i = 0

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
                        lobbyMembers?.map((member) => {
                            if (!(member.username === user.username)) i++
                            return (
                                member.username === user.username ? "" : <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} propsDetectiveUser={detectiveUser} index={i} />
                            )
                        })
                    }
                </div>
            </div>
        </div>
    );
}

export default GamePage;
