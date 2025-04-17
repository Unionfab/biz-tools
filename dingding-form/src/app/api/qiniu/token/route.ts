import { NextResponse } from "next/server";
import { QiniuService } from "@/server/qiniuService";

export async function GET() {
  try {
    const qiniuService = new QiniuService();
    const tokenInfo = qiniuService.generateUploadToken();

    const response = NextResponse.json(tokenInfo);

    // 设置不缓存的响应头
    // response.headers.set(
    //   "Cache-Control",
    //   "no-store, no-cache, must-revalidate, proxy-revalidate"
    // );
    // response.headers.set("Pragma", "no-cache");
    // response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("生成七牛云token失败:", error);
    return NextResponse.json({ error: "生成上传凭证失败" }, { status: 500 });
  }
}
