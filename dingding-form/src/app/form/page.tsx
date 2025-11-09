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
  Row,
  Col,
  Input,
  message,
  Skeleton,
  Spin,
  Upload,
} from "antd";
import { useEffect, useState, Suspense } from "react";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import {
  uploadToQiniu,
  validateFile,
  validateImage,
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
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const value = await form.getFieldsValue();

      if (!value.teacher) throw new Error("请选择投顾老师");

      const webhooks = getTeacherWebhooks(config, value.teacher);


      if (!!webhooks && (webhooks || []).length > 0) {
        const { fileUrls, imageUrls } = await handleSubmit();

        const md = createImageMarkdown({
          title: `招财转运 【${value.teacher}】 老师消息来啦`,
          text: value.message,
          imageUrls,
          fileUrls,
        });

        console.log("md", md);

        batchSendMarkdownMessage(webhooks, "招财转运", md);
      }
    },
    onSuccess: () => {
      message.success("提交成功！");

      setFileList([]);
      setImageFileList([])
      // form.resetFields();
      form.setFieldValue("message", null)
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "提交失败");
    },
  });

  const handleSubmit = async () => {
    let imageUrls: Record<"url" | "filename", string>[] = [];
    let fileUrls: Record<"url" | "filename", string>[] = [];

    try {
      console.log("start upload", fileList);

      if (imageFileList.length > 0) {
        // 上传所有图片并获取URL
        const imageUploadPromises = imageFileList.map(async (file) => {
          const url = await uploadToQiniu(file as any);

          if (!url) {
            throw new Error("上传失败");
          }

          return { url, filename: file.name };
        });

        imageUrls = await Promise.all(imageUploadPromises);
      }

      if (fileList.length > 0) {
        // 上传所有文件并获取URL
        const fileUploadPromises = fileList.map(async (file) => {
          const url = await uploadToQiniu(file as any);

          if (!url) {
            throw new Error("上传失败");
          }

          return { url, filename: file.name };
        });

        fileUrls = await Promise.all(fileUploadPromises);
      }

      return { fileUrls, imageUrls };
    } catch (error) {

      console.error("上传失败:", error);
      message.error("上传失败，请重试！");

      return { fileUrls, imageUrls };

    }
  };

  const uploadProps: UploadProps = {
    fileList: fileList,
    onRemove: (file: UploadFile) => {
      setFileList(fileList.filter((f) => f.uid !== file.uid));
    },
    beforeUpload: (file: UploadFile, _fileList: UploadFile[]) => {
      if (validateFile(file as any)) {
        console.log("file", file);

        // 使用函数式更新，确保状态更新正确
        setFileList((prev) => {
          // 检查是否已存在相同文件
          const exists = prev.some((f) => f.uid === file.uid);

          if (!exists) {
            return [...prev, file];
          }
          return prev;
        });
      }
      return false; // 阻止自动上传
    },
  };

  const imageUploadProps: UploadProps = {
    fileList: imageFileList,
    onRemove: (file: UploadFile) => {
      setImageFileList(imageFileList.filter((f) => f.uid !== file.uid));
    },
    beforeUpload: (file: UploadFile, _fileList: UploadFile[]) => {
      if (validateImage(file as any)) {
        // 使用函数式更新，确保状态更新正确
        setImageFileList((prev) => {
          // 检查是否已存在相同文件
          const exists = prev.some((f) => f.uid === file.uid);

          if (!exists) {
            return [...prev, file];
          }
          return prev;
        });
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
          <Form.Item label="上传图片" >
            <Upload accept="image/*" multiple {...imageUploadProps}>
              <Button icon={<UploadOutlined />}>Click to upload</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="上传文件" >
            <Upload accept="*" multiple {...uploadProps}>
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
