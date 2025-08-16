// 格式化时间戳为可读的日期时间格式
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);

  // 获取年月日时分秒
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // 格式化输出
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 示例使用
const timestamp = 1749022159444;
console.log("格式化后的时间:", formatTimestamp(timestamp));

// 其他格式化选项
function formatTimestampWithOptions(timestamp, options = {}) {
  const date = new Date(timestamp);

  // 默认选项
  const defaultOptions = {
    format: "YYYY-MM-DD HH:mm:ss",
    locale: "zh-CN",
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // 使用 Intl.DateTimeFormat 进行本地化格式化
  const formatter = new Intl.DateTimeFormat(mergedOptions.locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return formatter.format(date);
}

// 示例使用不同选项
console.log("使用本地化格式:", formatTimestampWithOptions(timestamp));
console.log(
  "使用自定义格式:",
  formatTimestampWithOptions(timestamp, { locale: "en-US" })
);
