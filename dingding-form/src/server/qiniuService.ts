import * as qiniu from "qiniu";

export class QiniuService {
  private mac: qiniu.auth.digest.Mac;
  private bucket: string;
  private domain: string;

  constructor() {
    const accessKey = process.env.NEXT_PUBLIC_QINIU_ACCESS_KEY || "";
    const secretKey = process.env.NEXT_PUBLIC_QINIU_SECRET_KEY || "";
    this.bucket = process.env.NEXT_PUBLIC_QINIU_BUCKET_NAME || "";
    this.domain = process.env.NEXT_PUBLIC_QINIU_PICTURE_RESOURCE_URL || "";

    if (!accessKey || !secretKey || !this.bucket || !this.domain) {
      throw new Error("七牛云配置未完成，请检查环境变量");
    }

    this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  }

  /**
   * 生成上传凭证
   * @returns 上传凭证和域名信息
   */
  generateUploadToken() {
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: this.bucket,
      expires: 3600 * 24, // token有效期24小时
    });

    const uploadToken = putPolicy.uploadToken(this.mac);

    return {
      token: uploadToken,
      // 添加时间戳确保每次返回不同的对象
      timestamp: Date.now(),
    };
  }
}
