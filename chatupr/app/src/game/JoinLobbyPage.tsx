import React, { useEffect, useState } from 'react'
import { RouteComponentProps } from 'react-router-dom';
import {
    useSocket,
    useSocketListener,
    ServerToClientPayload,
    ClientToServerPayload,
} from 'wasp/client/webSocket'

export const ChatPage = (props: RouteComponentProps<{ joinCode: string }>) => {
    const [roomOptions, setRoomOptions] = useState<
        // We are using a helper type to get the payload type for the "chatMessage" event.
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
        setRoomOptions({ roomId: props.match.params.joinCode, action: "create" })
        console.log(roomOptions);
    }, []);

    useEffect(() => {
        if (!roomOptions.roomId) {
            // console.warn("roomId is empty!")
            return;
        }

        socket.emit('roomOperation', roomOptions)
    }, [roomOptions]);


    useEffect(() => {
        if (!roomInfoArr?.clients.length || window.localStorage.getItem("roomInfo")) return;
        window.localStorage.setItem("roomInfo", JSON.stringify(roomInfoArr));
        window.location.href = window.location.origin + "/lobby";
    }, [roomInfoArr]);

    const connectionIcon = isConnected ? '🟢' : '🔴'

    return (
        <>
            <div className='py-32 lg:mt-10'>
                <div className='mx-auto max-w-7xl px-6 lg:px-8'>
                    <h2>Connection: {connectionIcon}</h2>
                    <h2 className='text-2xl font-bold'>Welcome to Chat UPR!</h2>
                    <h2 className='text-lg font-bold'>Room ID: {roomOptions.roomId}</h2>
                </div>
            </div>
        </>
    )
}

export default ChatPage;