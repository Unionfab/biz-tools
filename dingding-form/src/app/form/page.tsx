"use client"; // 添加这行，将页面标记为客户端组件

import styles from "./page.module.css";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "react-query";
import { UploadOutlined } from "@ant-design/icons";
import {
  Button,
  Typography,
  Select,
  Form,
  Input,
  message,
  Skeleton,
  Spin,
  Upload,
} from "antd";
import { useEffect, useState, Suspense } from "react";
import type { UploadFile } from "antd/es/upload/interface";
import {
  uploadToQiniu,
  getServerTime,
  validateFile,
} from "@/utils/qiniuUpload";
import {
  createImageMarkdown,
  getTeacherWebhooks,
  batchSendMarkdownMessage,
} from "@/utils/dingTalkService";
import config from "@/config/webhookConfig.json";

interface Config {
  teacher: {
    webhooks: { src: string; desc: string }[];
    name: string;
  }[];
}

const { Title } = Typography;

// 创建 QueryClient 实例
const queryClient = new QueryClient();

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Spin size="large" tip="加载中..." />}>
        <FormContent />
      </Suspense>
    </QueryClientProvider>
  );
}

const FormContent = () => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // const { data: config, isLoading } = useQuery({
  //   queryKey: ["config"],
  //   retry: 3,
  //   queryFn: async () => {
  //     const qiniuUrl = process.env.NEXT_PUBLIC_QINIU_CONFIG_RESOURCE_URL;
  //     const configPath = process.env.NEXT_PUBLIC_CONFIG_PATH;

  //     if (!qiniuUrl || !configPath) throw new Error("配置URL或路径未设置");

  //     const response = await fetch(qiniuUrl + configPath);

  //     return (await response.json()) as Config;
  //   },
  //   onError: (error) => {
  //     message.error("配置加载失败");
  //     console.error(error);
  //   },
  // });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const value = await form.getFieldsValue();

      if (!value.teacher) throw new Error("请选择投顾老师");

      const webhooks = getTeacherWebhooks(config, value.teacher);

      if (!!webhooks && (webhooks || []).length > 0) {
        const uploadUrls = await handleSubmit();

        const finalUrls = (uploadUrls || [])
          .concat(
            (value.urls || [])
              .replace(/\s+/g, "") // 移除所有换行符
              .split(";")
          )
          .filter((u) => !!u);

        const md = createImageMarkdown(
          `招财转运 【${value.teacher}】 老师消息来啦`,
          value.message,
          finalUrls
        );

        batchSendMarkdownMessage(webhooks, "招财转运", md);
      }
    },
    onSuccess: () => {
      message.success("提交成功！");

      setFileList([]);
      form.resetFields();
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "提交失败");
    },
  });

  const handleSubmit = async () => {
    if (fileList.length > 0) {
      try {
        console.log("start upload", fileList);

        // 上传所有文件并获取URL
        const uploadPromises = fileList.map(async (file) => {
          const url = await uploadToQiniu(file as any);

          if (!url) {
            throw new Error("上传失败");
          }

          return url;
        });

        return await Promise.all(uploadPromises);
      } catch (error) {
        console.error("上传失败:", error);
        message.error("上传失败，请重试！");
      }
    }
  };

  const uploadProps = {
    fileList: fileList,
    onRemove: (file: UploadFile) => {
      setFileList(fileList.filter((f) => f.uid !== file.uid));
    },
    beforeUpload: (file: UploadFile) => {
      if (validateFile(file as any)) {
        setFileList([...fileList, file]);
      }
      return false; // 阻止自动上传
    },
  };

  return (
    <div className={styles.page}>
      <Title level={2} style={{ fontWeight: "normal" }}>
        转发助手
      </Title>

      {!config ? (
        <Skeleton title={{ width: "50%" }} active paragraph={{ rows: 4 }} />
      ) : (
        <Form form={form} layout="vertical" style={{ width: "100%" }}>
          <Form.Item name="teacher" label="投顾老师">
            <Select
              allowClear
              options={(config.teacher || []).map((t) => ({
                label: t.name || "",
                value: t.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="message" label="消息内容">
            <Input.TextArea rows={4} autoSize={{ minRows: 6, maxRows: 12 }} />
          </Form.Item>
          <Form.Item
            label={
              <div>
                <span>图片链接（ ; 分隔可支持多张图片）</span>
                <Button
                  type="link"
                  href="https://www.superbed.cn/"
                  target="_blank"
                >
                  点击跳转图床
                </Button>
              </div>
            }
            name="urls"
          >
            <Input.TextArea rows={4} autoSize={{ minRows: 6, maxRows: 12 }} />
          </Form.Item>
          <Form.Item label="上传图片" name="images">
            <Upload accept="image/*" {...uploadProps}>
              <Button icon={<UploadOutlined />}>Click to upload</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              onClick={() => sendMessageMutation.mutate()}
              loading={sendMessageMutation.isLoading}
            >
              提交
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};
