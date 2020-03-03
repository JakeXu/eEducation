import { AgoraFetch } from "../utils/fetch";
import { ClassState } from "../stores/room";

const PREFIX: string = process.env.REACT_APP_AGORA_EDU_ENDPOINT_PREFIX as string;

const AUTHORIZATION_KEY: string = process.env.REACT_APP_AGORA_ENDPOINT_AK as string;

const AgoraFetchJson = async ({url, method, data, token, authorization}:{url: string, method: string, data?: any, token?: string, authorization?: string}) => {

  let authKey: string = AUTHORIZATION_KEY

  if (authorization) {
    authKey = authorization
  }
  
  const opts: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  }

  if (authKey) {
    opts.headers['Authorization'] = authKey
  }

  if (token) {
    opts.headers['token'] = token;
  }
  if (data) {
    opts.body = JSON.stringify(data);
  }

  let resp = await AgoraFetch(`${PREFIX}${url}`, opts);

  const {code, msg, data: responseData} = resp

  if (code !== 0) {
    throw new Error(msg)
  }

  return responseData
}

export interface EntryParams {
  userName: string
  roomName: string
  type: number
  role: number
}


export interface RoomParams {
  room: Partial<{
    muteAllChat: boolean
    lockBoard: number
    courseState: number
    [key: string]: any
  }>
  user: {
    userId: number
    enableChat: number
    enableVideo: number
    enableAudio: number
    grantBoard: number
    coVideo: number
    [key: string]: any
  }
}

export class AgoraEduApi {

  appID: string = '';
  authorization: string = '';
  roomId: string = '';
  userToken: string = '';
  recordId: string = '';

  // app config
  // 配置入口
  async config() {
    let data = await AgoraFetchJson({
      url: `/v1/config?platform=0&device=0&version=5.2.0`,
      method: 'GET',
    });

    return {
      appId: data.appId,
      authorization: data.authorization,
      room: data.room,
    }
  }

  // room entry
  // 房间入口
  async entry(params: EntryParams) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/entry`,
      method: 'POST',
      data: params,
      authorization: this.authorization,
    });
    
    this.roomId = data.room.roomId;
    this.userToken = data.user.userToken;
    return {
      data
    }
  }

  // refresh token
  // 刷新token 
  async refreshToken() {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/token/refresh`,
      method: 'POST',
      token: this.userToken,
      authorization: this.authorization,
    });
    return {
      data
    }
  }


  // update room state
  // 更新房间状态
  async updateRoom(params: Partial<RoomParams>) {
    const {room, user} = params
    const dataParams: any = {}
    if (room) {
      dataParams.room = room
    }
    if (user) {
      dataParams.users = [user]
    }
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}`,
      method: 'POST',
      data: dataParams,
      token: this.userToken,
      authorization: this.authorization
    });
    return {
      data,
    }
  }

  // start recording
  // 开始录制
  async startRecording() {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/record`,
      method: 'POST',
      token: this.userToken,
      authorization: this.authorization,
    });
    this.recordId = data.recordId
    return {
      data
    }
  }

  // stop recording
  // 结束录制
  async stopRecording() {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/${this.recordId}/stop`,
      method: 'POST',
      token: this.userToken,
      authorization: this.authorization,
    })
    return {
      data
    }
  }

  // get recording list
  // 获取录制列表
  async getRecordingList () {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/records`,
      method: 'GET',
      token: this.userToken,
      authorization: this.authorization,
    })
    return {
      data
    }
  }

  // get room info
  // 获取房间信息
  async getRoomInfoBy(roomId: string): Promise<{data: any}> {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}`,
      method: 'GET',
      token: this.userToken,
      authorization: this.authorization,
    });
    return {
      data
    }
  }

  // getCourseState
  // 获取房间状态
  async getCourseState(roomId: string): Promise<Partial<ClassState>> {
    const {data} = await this.getRoomInfoBy(roomId)
    const {users, room} = data

    const result: Partial<ClassState> = {
      roomName: room.roomName,
      roomId: room.roomId,
      courseState: room.courseState,
      roomType: room.type,
      muteChat: room.muteAllChat,
      recordId: room.recordId,
      recordingTime: room.recordingTime,
      isRecording: Boolean(room.isRecording),
      boardId: room.boardId,
      boardToken: room.boardToken,
      lockBoard: room.lockBoard,
    }

    const teacher = users.find((it: any) => it.role === 1)
    if (teacher) {
      result.teacherId = teacher.uid
      result.screenId = teacher.screenId
      result.screenToken = teacher.screenToken
    }

    return result
  }

  // login 登录教室
  async Login(params: EntryParams) {
    if (!this.appID) {
      let {appId, authorization} = await this.config()
      this.appID = appId
      this.authorization = authorization
    }
    if (!this.appID) throw `appId is empty: ${this.appID}`
    let {data: {room: {roomId}, user}} = await this.entry(params)

    const {
      userId,
      userToken,
      rtcToken,
      rtmToken,
      screenToken,
    } = user;

    const {data: {room, users}} = await this.getRoomInfoBy(roomId)

    const me = users.find((user: any) => user.userId === userId)

    if (me) {
      me.rtcToken = rtcToken
      me.rtmToken = rtmToken
      me.screenToken = screenToken
    }

    const teacherState = users.find((user: any) => +user.role === 1)

    const course: any = {
      rid: room.channelName,
      roomName: room.roomName,
      channelName: room.channelName,
      roomId: room.roomId,
      roomType: room.type,
      courseState: room.courseState,
      muteAllChat: room.muteAllChat,
      isRecording: room.isRecording,
      recordingTime: room.recordingTime,
      boardId: room.boardId,
      boardToken: room.boardToken,
      lockBoard: room.lockBoard,

      teacherId: undefined
    }

    if (teacherState) {
      course.teacherId = +teacherState.uid
    }

    const result = {
      course,
      me,
      users,
      appID: this.appID
    }

    return result
  }
}

export const eduApi = new AgoraEduApi();