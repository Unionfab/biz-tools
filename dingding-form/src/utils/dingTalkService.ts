import axios from "axios";
import crypto from "crypto";

interface DingTalkMessage {
  msgtype: string;
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  link?: {
    title: string;
    text: string;
    picUrl?: string;
    messageUrl: string;
  };
  // 其他类型可按需添加
}

interface Webhook {
  desc: string;
  src: string;
  secret?: string;
}

function getSign(secret: string) {
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;

  const sign = crypto
    .createHmac("sha256", secret)
    .update(stringToSign)
    .digest("base64");

  return {
    timestamp,
    sign: encodeURIComponent(sign),
  };
}

/**
 * 发送文本消息到钉钉群聊
 * @param webhook Webhook 地址
 * @param content 消息内容
 * @returns Promise<boolean> 是否发送成功
 */
export const sendTextMessage = async (
  webhook: Webhook,
  content: string
): Promise<boolean> => {
  const message: DingTalkMessage = {
    msgtype: "text",
    text: {
      content,
    },
  };

  return sendMessage(webhook, message);
};

/**
 * 发送 Markdown 消息到钉钉群聊
 * @param webhook Webhook 地址
 * @param title 消息标题
 * @param text Markdown 格式的消息内容
 * @returns Promise<boolean> 是否发送成功
 */
export const sendMarkdownMessage = async (
  webhook: Webhook,
  title: string,
  text: string
): Promise<boolean> => {
  const message: DingTalkMessage = {
    msgtype: "markdown",
    markdown: {
      title,
      text,
    },
  };

  return sendMessage(webhook, message);
};

/**
 * 发送图文链接消息到钉钉群聊
 * @param webhook Webhook 地址
 * @param title 标题
 * @param text 描述
 * @param messageUrl 点击消息后跳转的URL
 * @param picUrl 图片URL（可选）
 * @returns Promise<boolean> 是否发送成功
 */
export const sendLinkMessage = async (
  webhook: Webhook,
  title: string,
  text: string,
  messageUrl: string,
  picUrl?: string
): Promise<boolean> => {
  const message: DingTalkMessage = {
    msgtype: "link",
    link: {
      title,
      text,
      picUrl,
      messageUrl,
    },
  };

  return sendMessage(webhook, message);
};

function wrapLinks(text: string) {
  if (!text) return "";

  var urlRegex = new RegExp(
    '(https?:\\/\\/[^\\s<>\\"]+|www\\.[^\\s<>\\"]+|pan\\.baidu\\.com\\/s\\/[a-zA-Z0-9_-]+(?:\\?[^\\s<>\\"]*)?)',
    "g"
  );

  // 替换函数，处理不同类型的链接
  return text.replace(urlRegex, function (match: string) {
    if (match.indexOf("www.") === 0) {
      return "<https://" + match + ">";
    } else if (match.indexOf("pan.baidu.com") === 0) {
      return "<https://" + match + ">";
    } else {
      return "<" + match + ">";
    }
  });
}

/**
 * 生成带图片的 Markdown 消息
 * @param title 标题
 * @param text 文本内容
 * @param imageUrls 图片URL数组
 * @returns Promise<boolean> 是否发送成功
 */
export const createImageMarkdown = ({
  title,
  text,
  imageUrls,
  fileUrls,
}: {
  title: string;
  text: string;
  fileUrls?: Record<"url" | "filename", string>[];
  imageUrls?: Record<"url" | "filename", string>[];
}): string => {
  let markdownText = `### ${title}\n\n${wrapLinks(text)}\n\n`;

  // 添加图片
  if (imageUrls && imageUrls.length > 0) {
    imageUrls.forEach(({ url, filename }) => {
      markdownText += `![${filename}](${url})\n`;
    });
  }

  // 添加文件
  if (fileUrls && fileUrls.length > 0) {
    fileUrls.forEach(({ url, filename }) => {
      markdownText += `[${filename}(请及时下载保存)](${url})\n`;
    });
  }

  return markdownText;
};

/**
 * 发送消息到钉钉群聊
 * @param webhook Webhook 地址
 * @param message 消息内容
 * @returns Promise<boolean> 是否发送成功
 */
const sendMessage = async (
  webhook: Webhook,
  message: DingTalkMessage
): Promise<boolean> => {
  try {
    console.log("webhook", webhook);

    let webhookSrc = webhook.src;

    if (webhook?.secret) {
      const { timestamp, sign } = getSign(webhook.secret);

      console.log("timestamp", timestamp, sign);

      webhookSrc = `${webhook.src}&timestamp=${timestamp}&sign=${sign}`;
    }

    const response = await axios.post(
      "/api/dingTalk",
      {
        webhook: webhookSrc,
        message,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 200 && response.data.errcode === 0) {
      console.log("消息发送成功:", response.data);
      return true;
    } else {
      console.error("消息发送失败:", response.data);
      return false;
    }
  } catch (error) {
    console.error("发送钉钉消息出错:", error);
    return false;
  }
};

/**
 * 获取指定老师的所有 webhook
 * @param config 配置对象
 * @param teacherName 老师名称
 * @returns Webhook[] webhook 数组
 */
export const getTeacherWebhooks = (
  config: any,
  teacherName: string
): Webhook[] => {
  if (!config || !config.teacher) {
    return [];
  }

  const teacher = config.teacher.find((t: any) => t.name === teacherName);
  return teacher ? teacher.webhooks || [] : [];
};

/**
 * 批量发送 Markdown 消息到多个群
 * @param webhooks Webhook 地址数组
 * @param title 消息标题
 * @param text Markdown 格式的消息内容
 * @returns Promise<{success: number, failed: number}> 发送成功和失败的数量
 */
export const batchSendMarkdownMessage = async (
  webhooks: Webhook[],
  title: string,
  text: string
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  await Promise.all(
    webhooks.map(async (webhook) => {
      const result = await sendMarkdownMessage(webhook, title, text);
      if (result) {
        success++;
      } else {
        failed++;
      }
    })
  );

  return { success, failed };
};
