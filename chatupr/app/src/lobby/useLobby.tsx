import { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { getUserLobbySession, getUserLobby, joinLobby, createLobby } from "wasp/client/operations"
import { generateLobbyId } from './utils';
import { AuthUser } from 'wasp/auth';
import { Lobby } from 'wasp/entities';

export function useLobby(user: AuthUser, isConnected: boolean, socket: any) {
    const [lobbyInfo, setLobbyInfo] = useState<Lobby | null>();
    const location = useLocation();
    const hasRun = useRef(false);
    const history = useHistory();

    useEffect(() => {
        if (hasRun.current) return;
        let isCancelled = false;

        const handleLobbyOperations = async () => {
            console.log("cool");
            if (!isConnected || isCancelled) return;

            try {
                const lobbySession = await getUserLobbySession(user.username || "");
                const lobby = await getUserLobby();

                if (lobbySession?.username) {
                    if (!lobby?.roomId) return;
                    socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: "reconnect" });
                    setLobbyInfo(lobby);
                    return;
                }
                console.log("cool 2");

                if (lobby) {
                    if (!lobby?.roomId) return;
                    socket.emit('lobbyOperation', { lobbyId: lobby.roomId, action: "join" });
                    await joinLobby({ roomId: lobby.roomId });
                } else {
                    const newLobbyId = generateLobbyId(5);
                    socket.emit('lobbyOperation', { lobbyId: newLobbyId, action: "join" });
                    await createLobby({ roomId: newLobbyId });
                    const newLobby = await getUserLobby();
                    setLobbyInfo(newLobby);
                }
            } catch (err: any) {
                if (!isCancelled) {
                    console.error('Lobby operation failed:', err.message || 'Something went wrong');
                }
            }
        };

        if ((location.pathname === '/lobby' || location.pathname === '/chat') && !hasRun.current) {
            handleLobbyOperations();
            hasRun.current = true;
        }

        return () => {
            isCancelled = true;
        };
    }, [user, isConnected, socket, location.pathname]);


    const updateReadyState = () => {
        if (!lobbyInfo?.roomId) return;
        socket.emit('lobbyOperation', { lobbyId: lobbyInfo?.roomId, action: "ready" });
    }

    const leaveLobby = () => {
        console.log("leaving");

        if (!lobbyInfo?.roomId) return;
        socket.emit('lobbyOperation', { lobbyId: lobbyInfo?.roomId, action: "leave" });
        history.push("/")
    }

    return { lobbyInfo, updateReadyState, leaveLobby };
}
