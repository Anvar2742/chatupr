import React, { useEffect, useState } from "react";
import { useMemo } from "react";
import { AuthUser } from "wasp/auth";
import { generateGptResponse, getLobbyMsgs } from "wasp/client/operations";
import { ServerToClientPayload, useSocket } from "wasp/client/webSocket";
import { Lobby } from "wasp/entities";
import { Member } from "./utils";

// ChatBox component
const ChatBox = ({ user, member, currentUserIsDetective, propsDetectiveUser, index, propsLobbyInfo }: { user: AuthUser, member: Member, currentUserIsDetective: boolean, propsDetectiveUser: Member | undefined, index: number, propsLobbyInfo: Lobby }) => {
    const [messages, setMessages] = useState<ServerToClientPayload<'chatMessage'>[]>();
    const [inputValue, setInputValue] = useState("");
    const [isRobot, setIsRobot] = useState(false);
    const chatContext = [user.username, member.username].sort().join('-')
    const [filteredMsgs, setFilteredMsgs] = useState<ServerToClientPayload<'chatMessage'>[]>();
    const { socket, isConnected } = useSocket();


    useEffect(() => {
        const handleGetLobbyMsgs = async () => {
            try {
                const lobbyMsgs = await getLobbyMsgs(propsLobbyInfo?.roomId || "");

                if (lobbyMsgs) {
                    setMessages(() => {
                        const storedMessages = lobbyMsgs
                        return storedMessages.sort((a: { createdAt: number | Date; }, b: { createdAt: number | Date; }) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
                    })
                }
            } catch (err: any) {
                window.alert('Error: ' + (err.message || 'Something went wrong'));
            }
        };

        if (isConnected) {
            handleGetLobbyMsgs();
        }
    }, [socket, isConnected]);


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
                context: gptResponse.context,
                toUser: gptResponse.sender,
                isRobot: true,
                lobbyId: propsLobbyInfo?.roomId || "",
                content: gptResponse.msg,
            });
        }, gptTimeOut);
    }

    useEffect(() => {
        const handleMessage = (msg: ServerToClientPayload<'chatMessage'>) => {
            setMessages((prevMessages = []) => {
                const updatedMessages = [msg, ...prevMessages];
                return updatedMessages.sort((a: { createdAt: number | Date }, b: { createdAt: number | Date }) =>
                    new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
                );
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
            context: chatContext,
            content: inputValue,
            toUser: member.username,
            isRobot: false,
            lobbyId: propsLobbyInfo?.roomId || ""
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
                return messages?.filter(el => el.context === [propsDetectiveUser?.username, member.username].sort().join('-'))
            }
            return messages?.filter(el => el.context === chatContext)
        })
    }, [messages])

    const makeDesicion = (username: string, isRobot: boolean) => {
        console.log(username, isRobot);
    }

    if (!filteredMsgs) return

    return (
        <div className='border border-black-2 p-4 mb-4'>

            {/* <div>
                <img src={avatarPlaceholder} alt="" className='w-25 mb-2' />
                <p><strong>{member.username}</strong> {member.isDetective ? "🕵️" : "🐇"}</p>
            </div> */}
            <div className="flex justify-between">
                <h3 className='font-bold text-4xl'>{index}</h3>
                {propsDetectiveUser?.username === user.username ? <div className="">
                    <div className="flex items-center">
                        <label htmlFor="isRobot" className="mr-2">Робот?</label>
                        <input type="checkbox" name="isRobot" id="isRobot" checked={isRobot} onChange={() => setIsRobot(prevIsRobot => !prevIsRobot)} />
                    </div>
                    <button className="mt-2 p-2 text-white rounded bg-orange-500" onClick={() => makeDesicion(member.username, isRobot)}>Принять решение</button>
                </div> : ""}
            </div>
            <div className='border-black border-solid border p-5 shadow-2 shadow-slate-500 rounded-xl mt-10'>
                <ul className=''>
                    {filteredMsgs?.map((msg, index) => (
                        <li key={msg.createdAt.toString() || index} className={`
                        mb-2    
                        ${msg.fromUser === user.username
                                ? "text-right" // Current user sending a message
                                : msg.fromUser === propsDetectiveUser?.username && msg.toUser != user.username
                                    ? "text-right" // Detective's message and it isn't addressed to the current user
                                    : "" // Everyone else's message
                            }`}>
                            <div className={`flex flex-col ${propsDetectiveUser?.username === msg.fromUser ? "items-end" : "items-start"}`}>
                                <em>{propsDetectiveUser?.username === msg.fromUser ? "Detective" : "Rabbit"}</em>
                                <span className={`
                                py-1 px-4 rounded
                                ${msg.fromUser === user.username
                                        ? "bg-orange-300" // Current user sending a message
                                        : msg.fromUser === propsDetectiveUser?.username && msg.toUser != user.username
                                            ? "bg-orange-300" // Detective's message and it isn't addressed to the current user
                                            : "bg-blue-300" // Everyone else's message
                                    }`}
                                >{msg.content}</span>
                            </div>
                        </li>
                    ))}
                </ul>
                {(currentUserIsDetective || member.isDetective) && !(user.username === member.username) ? (
                    <form onSubmit={(e) => handleSubmit(e, member.isRobot, filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].fromUser === user.username ? false : true : user.username === propsDetectiveUser?.username ? true : false)}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full p-2 mt-2 border rounded"
                        />
                        <button type="submit" className={`mt-2 p-2 text-white rounded ${filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].fromUser === user.username ? "bg-gray-400 pointer-events-none" : "bg-blue-500" : user.username === propsDetectiveUser?.username ? "bg-blue-500" : "bg-gray-400 pointer-events-none"}`}>
                            {filteredMsgs.length ? filteredMsgs[filteredMsgs.length - 1].fromUser === user.username ? "Не твоя очередь" : "Отправить" : user.username === propsDetectiveUser?.username ? "Отправить" : "Не твоя очередь"}
                        </button>
                    </form>
                ) : null}
            </div>
        </div>
    );
};

export default ChatBox;