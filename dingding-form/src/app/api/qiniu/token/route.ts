import { NextResponse } from "next/server";
import { QiniuService } from "@/server/qiniuService";

export async function GET() {
  try {
    const qiniuService = new QiniuService();
    const tokenInfo = qiniuService.generateUploadToken();

    return NextResponse.json(tokenInfo);
  } catch (error) {
    console.error("生成七牛云token失败:", error);
    return NextResponse.json({ error: "生成上传凭证失败" }, { status: 500 });
  }
}
