import { RcFile } from "antd/es/upload";
import { message } from "antd";
import * as qiniu from "qiniu-js";

interface QiniuToken {
  token: string;
  domain: string;
}

/**
 * 获取上传凭证
 */
const getQiniuToken = async (): Promise<QiniuToken> => {
  try {
    const response = await fetch("/api/qiniu/token");

    if (!response.ok) {
      throw new Error("获取上传凭证失败");
    }
    return await response.json();
  } catch (error) {
    console.error("获取上传凭证失败:", error);
    throw error;
  }
};

/**
 * 上传文件到七牛云
 * @param file 要上传的文件
 * @returns Promise<string> 上传后的文件URL
 */
export const uploadToQiniu = (file: RcFile): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 获取上传凭证
      const { token } = await getQiniuToken();

      // 生成文件key
      const key = `images/${Date.now()}-${file.name.replace(/\s+/g, "")}`;

      // 创建直传任务
      const task = qiniu.createDirectUploadTask(
        { type: "file", data: file, key: key },
        {
          tokenProvider: async () => token,
        }
      );

      // 开始上传
      task.start();

      task.onComplete((result) => {
        if (!result) resolve("");

        resolve(
          process.env.NEXT_PUBLIC_QINIU_PICTURE_RESOURCE_URL +
            "/" +
            JSON.parse(result || "").key
        );
      });

      task.onProgress((progress) => {
        console.log("progress", progress);
      });

      task.onError((error) => {
        console.error("上传失败:", error);
        message.error("上传失败，请重试！");
        reject(error);
      });
    } catch (error) {
      console.error("上传失败:", error);
      message.error("上传失败，请重试！");
      reject(error);
    }
  });
};

/**
 * 验证文件
 * @param file 要验证的文件
 * @returns 是否通过验证
 */
export const validateFile = (file: RcFile): boolean => {
  // 验证文件类型
  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    message.error("只能上传图片文件!");
    return false;
  }

  // 验证文件大小（2MB）
  const isLt2M = file.size / 1024 / 1024 < 6;
  if (!isLt2M) {
    message.error("图片大小不能超过 6MB!");
    return false;
  }

  return true;
};
