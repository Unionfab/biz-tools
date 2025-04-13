// src/theme/themeConfig.ts
import { ThemeConfig } from "antd";

const theme: ThemeConfig = {
  token: {
    // 主色调 - 温暖的橙色
    colorPrimary: "#F86F03",

    // 辅助色
    colorSuccess: "#7FB77E", // 柔和的绿色
    colorWarning: "#FFA41B", // 琥珀色警告
    colorError: "#FF6464", // 柔和的红色
    colorInfo: "#F86F03", // 与主色一致

    // 中性色调
    colorText: "#F86F03", // 暖灰色文本
    colorTextSecondary: "#e0e0e0", // 次要文本

    // 背景色
    colorBgBase: "#FFF9F0", // 米白色背景

    // 边框相关
    colorBorder: "#FBE4D8", // 浅橙色边框
    borderRadius: 8, // 圆角
  },
  components: {
    Button: {
      colorPrimary: "#F86F03",
      colorPrimaryHover: "#FF8D29", // 鼠标悬停时的颜色
    },

    Form: {
      labelColor: "#e0e0e0",
    },

    Skeleton: {
      colorFill: "#FFF9F0",
    },

    Select: {
      colorText: "#292e3b",
    },
  },
};

export default theme;
