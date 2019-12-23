import React from 'react';
import OSS from "ali-oss";
import uuidv4 from 'uuid/v4';
import { PPTProgressListener, UploadManager } from "../../../utils/upload-manager";
import { PptKind, Room } from "white-web-sdk";
import { ossConfig, ossClient } from '../../../utils/helper';
import { whiteboard } from '../../../stores/whiteboard';

export type UploadBtnProps = {
  room: Room,
  uuid: string,
  roomToken: string,
  whiteboardRef?: HTMLDivElement,
  onProgress?: PPTProgressListener,
  onFailure?: (err: any) => void,
};

export const UploadBtn: React.FC<UploadBtnProps> = ({
  room, uuid, roomToken,
  whiteboardRef, onProgress, onFailure
}) => {
  const uploadDynamic = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      const uploadManager = new UploadManager(ossClient, room);
      const pptConverter = whiteboard.client.pptConverter(roomToken);
      await uploadManager.convertFile(
        file,
        pptConverter,
        PptKind.Dynamic,
        ossConfig.folder,
        uuid,
        onProgress,
      );
    } catch (err) {
      onFailure && onFailure(err);
      console.warn(err)
    }
  }

  const uploadStatic = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      const uploadManager = new UploadManager(ossClient, room);
      const pptConverter = whiteboard.client.pptConverter(roomToken);
      await uploadManager.convertFile(
        file,
        pptConverter,
        PptKind.Static,
        ossConfig.folder,
        uuid,
        onProgress);
    } catch (err) {
      onFailure && onFailure(err)
      console.warn(err)
    }
  }

  const uploadImage = async (event: any) => {
    try {
      const file = event.currentTarget.files[0];
      const uploadFileArray: File[] = [];
      uploadFileArray.push(file);
      const uploadManager = new UploadManager(ossClient, room);
      const $whiteboard = document.getElementById('whiteboard') as HTMLDivElement;
      if ($whiteboard) {
        const { clientWidth, clientHeight } = $whiteboard;
        await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, onProgress);
      } else {
        const clientWidth = window.innerWidth;
        const clientHeight = window.innerHeight;
        await uploadManager.uploadImageFiles(uploadFileArray, clientWidth / 2, clientHeight / 2, onProgress);
      }
    } catch (err) {
      onFailure && onFailure(err)
      console.warn(err)
    }
  }

  const uploadVideo = async (event: any) => {
    const uploadManager = new UploadManager(ossClient, room);
        const file = event.currentTarget.files[0];
        console.log("file ", file);
        const path = `/${ossConfig.folder}`
        const uuid = uuidv4();
        const res = await uploadManager.addFile(`${path}/video-${file.name}${uuid}`, file, 
          onProgress
        );
        const isHttps = res.indexOf("https") !== -1;
        let url;
        if (isHttps) {
            url = res;
        } else {
            url = res.replace("http", "https");
        }
        if (url && whiteboard.state.room) {
          whiteboard.state.room.insertPlugin({
            protocal: 'video',
            centerX: 0,
            centerY: 0,
            width: 480,
            height: 270,
            props: {
              videoUrl: url
            }
          });
        }
  }

  return (
    <div className="upload-btn">
      <div className="upload-items">
        <label htmlFor="upload-image">
          <div className="upload-image-resource"></div>
          <div className="text-container">
            <div className="title">Convert Picture</div>
            <div className="description">bmp, jpg, png, gif</div>
          </div>
        </label>
        <input id="upload-image" accept="image/*,.bmp,.jpg,.png,.gif"
          onChange={uploadImage} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-dynamic">
          <div className="upload-dynamic-resource"></div>
          <div className="text-container">
            <div className="title">Convert to Webpage</div>
            <div className="description">pptx only support</div>
          </div>
        </label>
        <input id="upload-dynamic" accept=".ppt,.pptx" onChange={uploadDynamic} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-static">
          <div className="upload-static-resource"></div>
          <div className="text-container">
            <div className="title">Convert to picture</div>
            <div className="description">ppt, pptx, word, pdf support</div>
          </div>
        </label>
        <input id="upload-static" accept="image/*,.doc, .docx,.ppt, .pptx,.pdf" onChange={uploadStatic} type="file"></input>
      </div>
      <div className="slice-dash"></div>
      <div className="upload-items">
        <label htmlFor="upload-video">
          <div className="upload-static-resource"></div>
          <div className="text-container">
            <div className="title">Upload video</div>
            <div className="description">mp4</div>
          </div>
        </label>
        <input id="upload-video" accept="video/*,.mp4" onChange={uploadVideo} type="file"></input>
      </div>
    </div>
  )
}