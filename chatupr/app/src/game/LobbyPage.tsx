import React, { useEffect, useState } from 'react'
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'
import { generateRoomId } from './utils';
import { createGame } from 'wasp/client/operations'

export const LobbyPage = () => {
    const [roomOptions, setRoomOptions] = useState<
        ClientToServerPayload<'roomOperation'>
    >({ roomId: "", action: "create" })

    const [roomInfoArr, setRoomInfoArr] = useState<{
        roomId: string, roomStatus: string, clients: {
            id: string;
            username: string;
            isReady: boolean;
        }[]
    }>();
    const [connectedClients, setConnectedClients] = useState<{ id: string; username: string; isReady: boolean; }[] | undefined>();

    // The "socket" instance is typed with the types you defined on the server.
    const { socket, isConnected } = useSocket()
    useSocketListener('roomOperation', logRoomInfo)
    function logRoomInfo(roomInfo: ServerToClientPayload<'roomOperation'>) {
        setRoomInfoArr(roomInfo);
    }


    useEffect(() => {
        // check if not already in a game
        setRoomOptions({ roomId: generateRoomId(5), action: "create" })
    }, []);

    useEffect(() => {
        if (!roomOptions.roomId) {
            // console.warn("roomId is empty!")
            return;
        }

        socket.emit('roomOperation', roomOptions)
    }, [roomOptions]);


    useEffect(() => {
        console.log(roomInfoArr)
        setConnectedClients(roomInfoArr?.clients);
        if (roomInfoArr?.clients) {
            handleGameCreate()
        }
    }, [roomInfoArr]);

    const handleGameCreate = async () => {
        try {
            await createGame();
        } catch (err: any) {
            window.alert('Error: ' + (err.message || 'Something went wrong'));
        }
    };

    const clientsList = connectedClients?.map((client) => (
        <li key={client.id}>
            <em>{client.username}</em>: {client.isReady}
        </li>
    ))

    const connectionIcon = isConnected ? '🟢' : '🔴'

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h2>Connection: {connectionIcon}</h2>
                    <ul>{clientsList}</ul>
                    <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                    <h2 className='text-lg font-bold'>Room ID: {roomOptions.roomId}</h2>
                    <h3>Invite your friends: {window.location.origin}/join/{roomOptions.roomId}</h3>
                </div>
            </div>
        </>
    )
}

export default LobbyPage;