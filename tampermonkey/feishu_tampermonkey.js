// ==UserScript==
// @name         飞书消息监控
// @namespace    http://tampermonkey.net/
// @version      2025-05-22
// @description  监控飞书消息并转发到本地服务
// @author       You
// @match        https://acnvf0j4zz2l.feishu.cn/next/messenger/
// @match        https://acnvf0j4zz2l.feishu.cn/next/messenger
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// ==/UserScript==

// 配置常量
const CONFIG = {
  REFRESH_INTERVAL: 60 * 30 * 1000,
  CHECK_INTERVAL: 60 * 1000, // 60s 监测一次
  STORAGE_KEYS: {
    LAST_REFRESH: "lastRefreshDate",
    LAST_CHECK: "lastCheckDate",
    LAST_POST: "lastPostData",
    SETTINGS: "monitorSettings",
  },
  API: {
    ENDPOINT: "http://localhost:8080",
    HEADERS: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    UPDATE_FILE_PATH: {
      杨宁: "C:\\WorkSpace\\理财文件\\飞书\\update\\yangning.json",
      睿见视界: "C:\\WorkSpace\\理财文件\\飞书\\update\\ruijian.json",
      梅森: "C:\\WorkSpace\\理财文件\\飞书\\update\\meisen.json",
      大爷周: "C:\\WorkSpace\\理财文件\\飞书\\update\\dayezhou.json",
    },
  },
  TIME_RANGE: {
    START_HOUR: 8,
    START_MINUTE: 15,
    END_HOUR: 23,
    END_MINUTE: 30,
    WEEKDAYS: [1, 2, 3, 4, 5, 6], // 周一到周五
  },
};

const getLocalPostFile = async (feedType) => {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: `${CONFIG.API.ENDPOINT}/read?path=${encodeURIComponent(
        CONFIG.API.UPDATE_FILE_PATH[feedType]
      )}`,
      headers: CONFIG.API.HEADERS,
      onload: (res) => {
        try {
          if (res.status !== 200) {
            console.error("读取本地文件失败，状态码:", res.status);
            reject(new Error(`读取本地文件失败，状态码: ${res.status}`));
            return;
          }

          const result = JSON.parse(res.responseText);
          console.log("获取本地日志文件:", result);
          resolve(result);
        } catch (error) {
          console.error("解析响应失败:", error);
          console.error("原始响应内容:", res.responseText);
          reject(error);
        }
      },
      onerror: (error) => {
        console.error("发送请求失败:", error);
        reject(error);
      },
    });
  });
};

(function () {
  "use strict";

  // 工具函数
  const utils = {
    storage: {
      get: (key) => {
        try {
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) : null;
        } catch (error) {
          console.error(`Storage get error for key ${key}:`, error);
          return null;
        }
      },
      set: (key, value) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          console.error(`Storage set error for key ${key}:`, error);
          return false;
        }
      },
    },

    isWithinTimeRange: () => {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTimeInMinutes = hour * 60 + minute;
      const startTimeInMinutes =
        CONFIG.TIME_RANGE.START_HOUR * 60 + CONFIG.TIME_RANGE.START_MINUTE;
      const endTimeInMinutes =
        CONFIG.TIME_RANGE.END_HOUR * 60 + CONFIG.TIME_RANGE.END_MINUTE;

      return (
        CONFIG.TIME_RANGE.WEEKDAYS.includes(day) &&
        currentTimeInMinutes >= startTimeInMinutes &&
        currentTimeInMinutes < endTimeInMinutes
      );
    },

    formatTime: (date) => {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  };

  // 消息处理类
  class MessageHandler {
    constructor() {
      this.lastPost = null;
    }

    loadLastPost() {
      this.lastPost = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_POST);
    }

    async isPostAlreadySent(feedType, posts) {
      const targetPosts = [];

      if (!posts || posts.length < 1) return targetPosts;

      try {
        const { data: localPostConfig } = await getLocalPostFile(feedType);
        console.log(">>> 本地消息列表", localPostConfig.posts);

        // 遍历新消息
        for (const newPost of posts) {
          if (!newPost?.data_id) continue;

          // 检查是否已存在
          let exists = false;
          for (const localPost of localPostConfig?.posts || []) {
            if (localPost.data_id === newPost.data_id) {
              // console.log(">>> 本地已写入当前日志不再重复写入", localPost);
              exists = true;
              break;
            }
          }

          // 如果消息不存在，则保存并返回
          if (!exists) {
            console.log(">>> 捕获到未写入消息", newPost);

            this.savePost({
              ...this.lastPost,
              [feedType]: {
                ...newPost,
                feedType,
                insertAt: new Date().toISOString(),
              },
            });

            targetPosts.push({
              ...newPost,
              feedType,
              insertAt: new Date().toLocaleString(),
            }); // 将新消息添加到数组
          } else {
            const storagePost = utils.storage.get(
              CONFIG.STORAGE_KEYS.LAST_POST
            );

            const localPost = (localPostConfig?.posts || []).find(
              (p) => p.data_id == newPost.data_id
            );

            if (!storagePost || storagePost?.data_id !== newPost.data_id) {
              console.log("====> savePost", newPost);
              this.savePost({
                ...this.lastPost,
                [feedType]: {
                  ...newPost,
                  feedType,
                  insertAt: localPost
                    ? localPost.insertAt
                    : new Date().toISOString(),
                },
              });
            }
          }
        }

        return targetPosts;
      } catch (e) {
        console.error("检查消息是否已发送时出错:", e);
        return targetPosts;
      }
    }

    savePost(post) {
      if (!post) return;
      utils.storage.set(CONFIG.STORAGE_KEYS.LAST_POST, post);
      this.lastPost = post;
    }

    async sendToServer(feedType, posts) {
      if (!posts || posts.length < 1) return;

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: CONFIG.API.ENDPOINT + "/writeToArray",
          headers: CONFIG.API.HEADERS,
          data: JSON.stringify({
            content: {
              posts: posts,
              filePath: CONFIG.API.UPDATE_FILE_PATH[feedType],
            },
          }),
          onload: (res) => {
            try {
              const result = JSON.parse(res.responseText);
              console.log("消息发送成功:", result);
              resolve(result);
            } catch (error) {
              console.error("解析响应失败:", error);
              reject(error);
            }
          },
          onerror: (error) => {
            console.error("发送请求失败:", error);
            reject(error);
          },
        });
      });
    }
  }

  // UI 控制面板类
  class ControlPanel {
    constructor(messageHandler) {
      this.messageHandler = messageHandler;
      this.panel = null;
    }

    create() {
      this.removeExisting();

      this.panel = document.createElement("div");
      this.panel.id = "checkNewPostsPanel";
      this.panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9999;
      width: 250px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

      this.update();
      document.body.appendChild(this.panel);
    }

    removeExisting() {
      const existing = document.getElementById("checkNewPostsPanel");
      if (existing) {
        existing.remove();
      }
    }

    update() {
      if (!this.panel) return;

      const checkTime = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_CHECK);
      // const reFreshTime = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_REFRESH);

      this.messageHandler.loadLastPost(); // 更新前重新加载最新消息
      const lastPost = this.messageHandler.lastPost;

      if (!utils.isWithinTimeRange()) {
        this.panel.innerHTML = `
      <div>
        <h3 style="margin:0 0 10px 0;font-size:16px">监控已停止</h3>
      </div>
    `;
      } else {
        this.panel.innerHTML = `
      <div>
        <h3 style="margin:0 0 10px 0;font-size:16px">监控运行中...</h3>
        <div style="font-size:14px;line-height:1.4">
          <div>上次刷新时间：${
            checkTime ? utils.formatTime(new Date(checkTime)) : "无"
          }</div>
          <div>消息捕获时间：${
            lastPost?.insertAt
              ? utils.formatTime(new Date(lastPost?.insertAt))
              : "无"
          }</div>
          <div style="margin: 8px 0; border-bottom:1px solid white"></div>
          <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容【杨宁】：${
            lastPost?.杨宁?.content || "无"
          }</h4>
          <div style="margin: 8px 0; border-bottom:1px solid white"></div>
          <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容【睿见视界】：${
            lastPost?.睿见视界?.content || "无"
          }</h4>
          <div style="margin: 8px 0; border-bottom:1px solid white"></div>
          <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容【梅森】：${
            lastPost?.梅森?.content || "无"
          }</h4>
          <div style="margin: 8px 0; border-bottom:1px solid white"></div>
          <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容【大爷周】：${
            lastPost?.大爷周?.content || "无"
          }</h4>
        </div>
      </div>
    `;
      }
    }
  }

  // 主监控类
  class MessageMonitor {
    constructor() {
      this.messageHandler = new MessageHandler();
      this.controlPanel = new ControlPanel(this.messageHandler);
      this.isRunning = false;
      this.checkTimer = null;
      this.refreshTimeout = null; // 添加刷新定时器引用
    }

    selectFeedItem(feedType) {
      // 选中元素后进行操作
      let element;

      if (feedType == "睿见视界") {
        element = document.querySelector(
          '[data-feed-id="7507981302985916435"]'
        );
      } else if (feedType == "杨宁") {
        element = document.querySelector(
          '[data-feed-id="7458115569351426076"]'
        );
      } else if (feedType == "梅森") {
        element = document.querySelector(
          '[data-feed-id="7545426336593674259"]'
        );
      } else if (feedType == "大爷周") {
        element = document.querySelector(
          '[data-feed-id="7530465638810075155"]'
        );
      }

      const targetElement = element.querySelector(".a11y_feed_card_item");

      if (targetElement) {
        // 添加事件监听
        targetElement.click();
      } else {
        console.log("未找到指定元素");
      }
    }

    getLatestPosts() {
      try {
        const items = document.querySelectorAll(".messageItem-wrapper ");

        console.log("====> feeditems", items);

        if (!items.length) return null;

        const posts = Array.from(items)
          .slice(-15)
          .map((item) => {
            try {
              const innerText = item.innerText || "";
              const data_id = item.getAttribute("data-id");
              const hasImg =
                item.getElementsByClassName("base-image__content").length > 0;

              const messageLeft = item.querySelectorAll(".message-left");
              const messageInfo = item.querySelectorAll(".message-info");

              // 检查是否有元素
              if (messageLeft && messageLeft.length > 0) {
                // 循环设置每个元素的 display 为 none
                messageLeft.forEach((left) => {
                  left.style.display = "none";
                });
              }

              if (messageInfo && messageInfo.length > 0) {
                // 循环设置每个元素的 display 为 none
                messageInfo.forEach((info) => {
                  info.style.display = "none";
                });
              }

              if (!hasImg || innerText.includes("pan.baidu.com")) {
                return { content: item.innerText, data_id: data_id };
              }

              // const target = item.getElementsByClassName("messageItem-wrapper");

              return { content: data_id, data_id: data_id };
            } catch (err) {
              console.error("解析消息元素失败:", err);
              return null;
            }
          })
          .filter(Boolean);

        return posts.length > 0 ? posts : [];
      } catch (error) {
        console.error("获取最新消息失败:", error);
        return [];
      }
    }

    async start() {
      if (this.isRunning) return;
      this.isRunning = true;

      const doListen = async (panelType) => {
        console.log("启动消息监控");

        if (!utils.isWithinTimeRange()) {
          this.controlPanel.create();

          console.log("⛔ 不在工作时间范围");
          return;
        }

        console.log("执行定时检查:", utils.formatTime(new Date()));

        utils.storage.set(
          CONFIG.STORAGE_KEYS.LAST_CHECK,
          new Date().toISOString()
        );

        const targetPosts1 = await this.checkNewPosts("杨宁");
        const targetPosts2 = await this.checkNewPosts("睿见视界");
        const targetPosts3 = await this.checkNewPosts("梅森");
        const targetPosts4 = await this.checkNewPosts("大爷周");

        try {
          await this.messageHandler.sendToServer("杨宁", targetPosts1);
          await this.messageHandler.sendToServer("睿见视界", targetPosts2);
          await this.messageHandler.sendToServer("梅森", targetPosts3);
          await this.messageHandler.sendToServer("大爷周", targetPosts4);
        } catch (error) {
          console.error("发送消息失败:", error);
        }

        if (panelType == "create") {
          this.controlPanel.create();
        } else {
          this.controlPanel.update();
        }
      };

      // 等待首次检查完成
      await doListen("create");

      // 存储定时器引用
      this.checkTimer = setInterval(async () => {
        await doListen("update");
      }, CONFIG.CHECK_INTERVAL);

      // 添加每小时刷新页面的定时器
      this.refreshTimeout = setTimeout(() => {
        // 在刷新前保存当前状态
        const currentTime = new Date().toLocaleString();

        console.log(`准备刷新页面，当前时间：${currentTime}`);

        // 记录刷新时间
        utils.storage.set(
          CONFIG.STORAGE_KEYS.LAST_REFRESH,
          new Date().toISOString()
        );

        // 3秒后刷新页面
        setTimeout(() => {
          // 清理所有定时器
          this.stop();
          // 刷新页面
          window.location.reload();
        }, 3000);
      }, CONFIG.REFRESH_INTERVAL);
    }

    async checkNewPosts(feedType) {
      try {
        this.selectFeedItem(feedType);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 获取消息列表容器
        const messageContainer = document.querySelector(
          ".messageList .scroller"
        );

        // 在容器内部滑动到底部
        if (messageContainer) {
          messageContainer.scrollTo({
            top: messageContainer.scrollHeight + 2000,
          });

          // 等待滚动完成
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        const posts = this.getLatestPosts();

        console.log(">>> 获取到【" + feedType + "】消息列表", posts);

        const targetPosts = await this.messageHandler.isPostAlreadySent(
          feedType,
          posts
        );

        console.log("发现【" + feedType + "】新消息:", targetPosts);

        if ((targetPosts || []).length < 1) return;

        return targetPosts;
      } catch (error) {
        console.error("检查新消息时出错:", error);
      }
    }

    stop() {
      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
      // 清理页面刷新定时器
      if (this.refreshTimeout) {
        clearInterval(this.refreshTimeout);
        this.refreshTimeout = null;
      }

      this.isRunning = false;
      this.controlPanel.removeExisting();
    }
  }

  // 初始化
  window.onload = function () {
    console.log("页面加载完成，准备启动监控");

    const monitor = new MessageMonitor();
    monitor.start();

    // 添加页面卸载时的清理
    window.addEventListener("beforeunload", () => {
      monitor.stop();
    });
  };
})();
