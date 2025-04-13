import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    // 从请求中提取需要的数据
    const body = await request.json();
    const { webhook, message } = body;

    if (!webhook || !message) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 使用axios发送请求到钉钉
    const response = await axios.post(webhook, message, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 返回钉钉的响应
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("发送钉钉消息出错:", error);
    return NextResponse.json(
      {
        error: "发送消息失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}
