import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { getUserLobby } from 'wasp/client/operations';
import { AuthUser } from 'wasp/auth';
import { Lobby } from 'wasp/entities';
import { useHistory } from 'react-router-dom';
import { Member, shuffle } from './utils';
import ChatBox from './ChatBox';
import { useLobby } from './useLobby';

export const GamePage = ({ user }: { user: AuthUser }) => {
    const { socket, isConnected } = useSocket();
    const [lobbyMembers, setLobbyMembers] = useState<Member[]>([]);
    const [detectiveUser, setDetectiveUser] = useState<Member>();
    // const [lobbyInfo, setLobbyInfo] = useState<Lobby>()
    const history = useHistory();
    const { lobbyInfo, leaveLobby } = useLobby(user, isConnected, socket);

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

    const connectionIcon = isConnected ? '🟢' : '🔴'

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
                                member.username === user.username ? "" : <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} propsDetectiveUser={detectiveUser} index={i} propsLobbyInfo={lobbyInfo} />
                            )
                        })
                    }
                </div>
            </div>
        </div>
    );
}

export default GamePage;
