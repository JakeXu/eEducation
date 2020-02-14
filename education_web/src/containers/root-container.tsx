import React, { useEffect, useRef } from 'react';
import { GlobalState, globalStore} from '../stores/global';
import { RoomState, roomStore} from '../stores/room';
import { WhiteboardState, whiteboard } from '../stores/whiteboard';
import { useHistory, useLocation } from 'react-router-dom';
import { resolveMessage, resolvePeerMessage, resolveChannelAttrs, jsonParse } from '../utils/helper';
import GlobalStorage from '../utils/custom-storage';

export type IRootProvider = {
  globalState: GlobalState
  roomState: RoomState
  whiteboardState: WhiteboardState
}

export interface IObserver<T> {
  subscribe: (setState: (state: T) => void) => void
  unsubscribe: () => void
  defaultState: T
}

function useObserver<T>(store: IObserver<T>) {
  const [state, setState] = React.useState<T>(store.defaultState);
  React.useEffect(() => {
    store.subscribe((state: any) => {
      setState(state);
    });
    return () => {
      store.unsubscribe();
    }
  }, []);

  return state;
}


export const RootContext = React.createContext({} as IRootProvider);

export const useStore = () => {
  const context = React.useContext(RootContext)
  if (context === undefined) {
    throw new Error('useStore must be used within a RootProvider');
  }
  return context;
}

export const useGlobalState = () => {
  return useStore().globalState;
}

export const useRoomState = () => {
  return useStore().roomState;
}

export const useWhiteboardState = () => {
  return useStore().whiteboardState;
}

export const RootProvider: React.FC<any> = ({children}) => {
  const globalState = useObserver<GlobalState>(globalStore);
  const roomState = useObserver<RoomState>(roomStore);
  const whiteboardState = useObserver<WhiteboardState>(whiteboard);
  const history = useHistory();

  const ref = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      ref.current = true;
    }
  }, []);

  const value = {
    globalState,
    roomState,
    whiteboardState,
  }

  useEffect(() => {
    if (!roomStore.state.rtm.joined) return;
    const rtmClient = roomStore.rtmClient;
    rtmClient.on('ConnectionStateChanged', ({ newState, reason }: { newState: string, reason: string }) => {
      console.log(`newState: ${newState} reason: ${reason}`);
      if (reason === 'LOGIN_FAILURE') {
        globalStore.showToast({
          type: 'rtmClient',
          message: 'login failure'
        });
        history.push('/');
        return;
      }
      if (reason === 'REMOTE_LOGIN' || newState === 'ABORTED') {
        globalStore.showToast({
          type: 'rtmClient',
          message: 'kick'
        });
        history.push('/');
        return;
      }
    });
    rtmClient.on("MessageFromPeer", ({ message: { text }, peerId, props }: { message: { text: string }, peerId: string, props: any }) => {
      const body = resolvePeerMessage(text);
      resolveMessage(peerId, body);
      roomStore.handlePeerMessage(body.cmd, peerId)
      .then(() => {
      }).catch(console.warn);
    });
    rtmClient.on("AttributesUpdated", (attributes: object) => {
      const channelAttrs = resolveChannelAttrs(attributes);
      console.log('[rtm-client] updated resolved attrs', channelAttrs);
      console.log('[rtm-client] updated origin attributes', attributes);
      roomStore.updateRoomAttrs(channelAttrs)
    });
    rtmClient.on("MemberJoined", (memberId: string) => {
    });
    rtmClient.on("MemberLeft", (memberId: string) => {
      if (roomStore.state.applyUid === +memberId) {
        roomStore.updateCourseLinkUid(0)
        .then(() => {
          globalStore.removeNotice();
        }).catch(console.warn);
      }
    });
    rtmClient.on("MemberCountUpdated", (count: number) => {
      !ref.current && roomStore.updateMemberCount(count);
    });
    rtmClient.on("ChannelMessage", ({ memberId, message }: { message: { text: string }, memberId: string }) => {
      const msg = jsonParse(message.text);
      const chatMessage = {
        account: msg.account,
        text: msg.content,
        link: msg.link,
        ts: +Date.now(),
        id: memberId,
      }
      console.log("[rtmClient] ChannelMessage", msg);
      roomStore.updateChannelMessage(chatMessage);
    });
    return () => {
      rtmClient.removeAllListeners();
    }
  }, [roomStore.state.rtm.joined]);

  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') {
      return;
    }

    const room = value.roomState;
    // 业务TODO: 这里根据你的实际情况去保存变动的状态
    GlobalStorage.save('agora_room', {
      me: room.me,
      course: room.course,
      mediaDevice: room.mediaDevice,
      liveRoom: room.liveRoom,
    });
    // TODO WARN: 这里window自定义的状态在上线时建议用Symbol作为key或者直接删除
    //@ts-ignore
    window.room = roomState;
    //@ts-ignore
    window.state = globalState;
    //@ts-ignore
    window.whiteboard = whiteboardState;
  }, 
  // 业务TODO: 这里的value是根据 
  // 这里会观察globalState roomState whiteboardState三种状态变化触发useEffect里的回调函数
    [value, location]
  );
  return (
    <RootContext.Provider value={value}>
      {children}
    </RootContext.Provider>
  )
}