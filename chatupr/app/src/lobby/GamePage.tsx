import React, { useState, useCallback, useEffect } from 'react';
import { useSocket, useSocketListener, ServerToClientPayload } from 'wasp/client/webSocket';
import { AuthUser } from 'wasp/auth';
import { useHistory } from 'react-router-dom';
import { Member, shuffle } from './utils';
import ChatBox from './ChatBox';
import { useLobby } from './useLobby';

export const GamePage = ({ user }: { user: AuthUser }) => {
    const { socket, isConnected } = useSocket();
    const [isVoting, setIsVoting] = useState(false);
    const [lobbyMembers, setLobbyMembers] = useState<Member[]>([]);
    const [detectiveUser, setDetectiveUser] = useState<Member>();
    const history = useHistory();
    const { lobbyInfo, leaveLobby } = useLobby(user, isConnected, socket);
    const [isGameOver, setIsGameOver] = useState(false);
    const [winnerUser, setWinnerUser] = useState<Member>()
    const [hostUser, setHostUser] = useState<Member>()
    const [lobbyStatus, setLobbyStatus] = useState<String>()

    // Listen for lobby updates
    useSocketListener('lobbyOperation', useCallback((serverLobbyInfo: ServerToClientPayload<'lobbyOperation'>) => {
        if (serverLobbyInfo.lobbyStatus === "dead") {
            history.push("/")
        }
        const membsCanPlay = serverLobbyInfo.clients.filter(el => el.canPlay)
        if (membsCanPlay.length === 1 && lobbyMembers.length > 0) {
            setIsGameOver(true);
            setWinnerUser(membsCanPlay[0])
        }

        const detective = serverLobbyInfo.clients.find(member => member.isDetective);
        setDetectiveUser(detective);
        setLobbyMembers((prevMembers) => {
            return shuffle([...serverLobbyInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true, canPlay: true }])
        });
        // setLobbyStatus(serverLobbyInfo.lobbyStatus)
        // console.log(serverLobbyInfo.lobbyStatus);
    }, []));

    // Listen for desicion updates
    useSocketListener('desicion', useCallback((serverDesicionInfo: ServerToClientPayload<'desicion'>) => {
        if (serverDesicionInfo.isCorrect) {
            alert(`Детектив прав! Игрок: ${serverDesicionInfo.username} грязный человек.`)
            const membsCanPlay = serverDesicionInfo.clients.filter(el => el.canPlay)
            if (membsCanPlay.length === 1) {
                setIsGameOver(true);
                setWinnerUser(membsCanPlay[0])
                alert(`Пользователь: ${membsCanPlay[0].username} победил!`)
                return;
            }
            setLobbyMembers((prevMembers) => {
                return shuffle([...serverDesicionInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true, canPlay: true }])
            });
            setLobbyStatus(serverDesicionInfo.lobbyStatus)
            return;
        }

        const membsCanPlay = serverDesicionInfo.clients.filter(el => el.canPlay)
        if (membsCanPlay.length === 1) {
            setIsGameOver(true);
            setWinnerUser(membsCanPlay[0])
            alert(`Пользователь: ${membsCanPlay[0].username} победил!`)
            return;
        }
        const detective = serverDesicionInfo.clients.find(member => member.isDetective);
        setDetectiveUser(detective);
        setLobbyMembers((prevMembers) => {
            return shuffle([...serverDesicionInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true, canPlay: true }])
        });
        // setLobbyStatus(serverDesicionInfo.lobbyStatus)
    }, []));


    useSocketListener('restart', useCallback((serverLobbyInfo: ServerToClientPayload<'restart'>) => {
        const detective = serverLobbyInfo.clients.find(member => member.isDetective);
        setDetectiveUser(detective);
        setIsGameOver(false)
        setIsVoting(false)
        setLobbyMembers((prevMembers) => {
            return shuffle([...serverLobbyInfo.clients, { username: "chatgpt", isDetective: false, isReady: true, isRobot: true, canPlay: true }])
        });
        // setLobbyStatus(serverLobbyInfo.lobbyStatus)
    }, []));

    useEffect(() => {
        if (!lobbyMembers) return;

        setHostUser(() => {
            return lobbyMembers.find(el => el.isHost)
        })
        setLobbyStatus(lobbyInfo?.lobbyState)
    }, [lobbyMembers, lobbyInfo])

    useEffect(() => {
        if (lobbyStatus === "end") {
            const membsCanPlay = lobbyMembers.filter(el => el.canPlay)
            if (membsCanPlay.length === 1) {
                setIsGameOver(true);
                setWinnerUser(membsCanPlay[0])
            }
        }
    }, [lobbyStatus])

    const handleStartOver = () => {
        const lobbyId = lobbyInfo?.roomId || ""
        console.log
        socket.emit("restart", { lobbyId })
    }

    const connectionIcon = isConnected ? '🟢' : '🔴'

    let i = 0

    if (!lobbyStatus) return;

    if (isGameOver || lobbyStatus === "end") {
        return (
            <div className='py-32 lg:mt-10'>
                <p>Game over!</p>
                <h2>Winner: {winnerUser?.username}</h2>
                {hostUser?.username === user.username ? <button className='rounded shadow-xl active:shadow-sm transition-all py-2 px-5 bg-green-500 active:scale-90 text-white font-bold m-auto block mt-10' onClick={handleStartOver}>Start over</button> : ""}
            </div>
        )
    }

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
                                member.username === user.username ? "" : <ChatBox key={member.username} member={member} user={user} currentUserIsDetective={detectiveUser?.username === user.username} propsDetectiveUser={detectiveUser} index={i} propsLobbyInfo={lobbyInfo} isVoting={isVoting} canCurrentPlay={lobbyMembers.filter(member => member.canPlay && member.username === user.username).length > 0} />
                            )
                        })
                    }
                </div>
            </div>

            {detectiveUser?.username === user.username ? <button className='rounded shadow-xl active:shadow-sm transition-all py-2 px-5 bg-red-500 active:scale-90 text-white font-bold m-auto block mt-10' onClick={() => setIsVoting(prev => !prev)}>{isVoting ? "Не голосовать" : "Голосовать"}!</button> : ""}
            <p className='text-lg font-bold'>{lobbyMembers.filter(member => !member.canPlay && member.username === user.username).length ? "Ты выбыл (лох)" : ""}</p>
        </div>
    );
}

export default GamePage;
