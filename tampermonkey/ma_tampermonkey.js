// ==UserScript==
// @name         监控老马消息
// @namespace    http://tampermonkey.net/
// @version      2025-05-22
// @description  监控老马消息并转发到本地服务
// @author       You
// @run-at       document-start
// @match        https://h5.sass.zhuoshangsoft.com/pages/circle/index?teacher_code=3825633306
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// ==/UserScript==

// 配置常量
const CONFIG = {
  SECRET_KEY: "乾坤定势VIP个股跟踪提醒",
  REFRESH_INTERVAL: 60 * 30 * 1000,
  CHECK_INTERVAL: 20 * 1000, // 20s 监测一次
  STORAGE_KEYS: {
    LAST_REFRESH: "lastRefreshDate",
    LAST_CHECK: "lastCheckDate",
    LAST_POST: "lastPostData",
    SETTINGS: "monitorSettings",
  },
  API: {
    ENDPOINT: "http://localhost:8080",
    HEADERS: {
      Accept: "*",
      "Content-Type": "application/json; charset=UTF-8",
    },
    UPDATE_FILE_PATH: "C:\\WorkSpace\\理财文件\\马老师\\update\\update.json",
    CONFIG_FILE_PATH: "C:\\WorkSpace\\理财文件\\马老师\\日志文件\\posts.json",
  },
  TIME_RANGE: {
    START_HOUR: 8,
    START_MINUTE: 15,
    END_HOUR: 16,
    END_MINUTE: 50,
    WEEKDAYS: [1, 2, 3, 4, 5], // 周一到周五
  },
};

const getPostList = async () => {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://api.sass.zhuoshangsoft.com/teacher-posts/list",
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/x-www-form-urlencoded",
        priority: "u=1, i",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        referer: "https://h5.sass.zhuoshangsoft.com/",
      },
      // data: "teacher_code=3825633306&page=1&size=10&token=27c30828a1fd47040025a457fc8e2125",
      data: "teacher_code=3825633306&page=1&size=10&last_id=&token=27c30828a1fd47040025a457fc8e2125&browserName=chrome&browserVersion=109.0.0.0&hostVersion=109.0.0.0&deviceModel=PC&deviceBrand=&osVersion=10^%^20x64&osName=windows&host=h5.sass.zhuoshangsoft.com&cid=&version_num=1.9.3&versionNums=193&downSource=update&env=prod&source=h5",
      onload: function (response) {
        try {
          const result = JSON.parse(response.responseText);
          console.log("Response:", result);
          // 确保返回的是数组
          if (result && result.data && Array.isArray(result.data.list)) {
            resolve(result.data.list);
          } else {
            resolve([]); // 如果没有数据，返回空数组
          }
        } catch (error) {
          console.error("解析响应失败:", error);
          reject(error);
        }
      },
      onerror: function (error) {
        console.error("Request failed", error);
        reject(error);
      },
    });
  });
};

const getLocalPostFile = async () => {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: `${CONFIG.API.ENDPOINT}/read?path=${encodeURIComponent(
        CONFIG.API.UPDATE_FILE_PATH
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

    async loadLastPost() {
      this.lastPost = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_POST);

      const postList = await getPostList();

      console.log(">>> 远程消息列表", postList);

      for (const post of postList) {
        if ((post?.secret_content || "").includes(CONFIG.SECRET_KEY)) {
          console.log(">>> 捕获到 vip 消息", post);

          if ((post?.secret_content || "") == (post?.content || "")) {
            console.log(">>> 登录过期");

            setTimeout(() => {
              window.location.reload();
            }, 2000);
            break;
          }

          // 触发新消息检查
          await this.checkNewPosts(post);
          break; // 找到第一个符合条件的消息后立即跳出循环
        }
      }
    }

    async checkNewPosts(post) {
      if (!post) {
        console.warn("收到空消息");
        return;
      }

      try {
        const res = await this.isPostAlreadySent(post);

        if (res) return;

        await this.sendToServer(post);
      } catch (error) {
        console.error("检查新消息时出错:", error);
      }
    }

    async isPostAlreadySent(post) {
      if (!post) return false;

      try {
        const { data: localPostConfig } = await getLocalPostFile();

        console.log(">>> 本地消息列表", localPostConfig.posts);

        for (const localPost of localPostConfig?.posts || []) {
          if (localPost.post_code === post.post_code) {
            console.log(">>> 本地已写入当前日志不再重复写入", localPost);

            const storagePost = utils.storage.get(
              CONFIG.STORAGE_KEYS.LAST_POST
            );

            if (!storagePost || storagePost?.post_code !== post.post_code) {
              this.savePost(post);
            }

            return true; // 已存在，返回 true
          }
        }

        return false; // 不存在，返回 false
      } catch (error) {
        console.error("检查本地文件失败:", error);
        return false; // 出错时默认返回 false，允许重新发送
      }
    }

    savePost(post) {
      if (!post) {
        throw new Error("无效的消息数据");
      }

      console.log(">>> 存入 storage", post);
      this.lastPost = post;
      utils.storage.set(CONFIG.STORAGE_KEYS.LAST_POST, post);
    }

    async sendToServer(post) {
      if (!post) return;

      console.log(">>> 更新本地文件触发自动化程序");

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: CONFIG.API.ENDPOINT + "/write",
          headers: CONFIG.API.HEADERS,
          data: JSON.stringify({
            content: {
              post: post,
              filePath: CONFIG.API.UPDATE_FILE_PATH,
              insertAt: new Date().toLocaleString(),
            },
          }),
          onload: (res) => {
            try {
              const result = JSON.parse(res.responseText);
              console.log("消息发送成功:", result);
              resolve(result);

              setTimeout(() => {
                window.location.reload();
              }, 1000);
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
      const reFreshTime = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_REFRESH);
      const lastPost = this.messageHandler.lastPost;

      if (!utils.isWithinTimeRange()) {
        this.panel.innerHTML = `
  <div>
    <h3 style="margin:0 0 10px 0;font-size:16px">监控已停止，不在工作时间范围</h3>
  </div>
`;
      } else {
        this.panel.innerHTML = `
  <div>
    <h3 style="margin:0 0 10px 0;font-size:16px">监控运行中...</h3>
    <div style="font-size:14px;line-height:1.4">
    <div>上次刷新时间：${
      reFreshTime ? utils.formatTime(new Date(reFreshTime)) : "无"
    }</div>
      <div>上次检查时间：${
        checkTime ? utils.formatTime(new Date(checkTime)) : "无"
      }</div>
      <div>POST CODE: ${lastPost?.post_code || "-"}</div>
      <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容：${
        lastPost?.share_intro || "无"
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
      this.listenPostTimer = null;
      this.refreshTimeout = null;
    }

    async start() {
      if (this.isRunning) return;

      this.isRunning = true;

      const doListen = async () => {
        if (!utils.isWithinTimeRange()) {
          console.log("⛔ 不在工作时间范围");
          this.controlPanel.create();
          return;
        }

        console.log("执行定时检查:", utils.formatTime(new Date()));

        await this.messageHandler.loadLastPost();

        utils.storage.set(
          CONFIG.STORAGE_KEYS.LAST_CHECK,
          new Date().toISOString()
        );

        this.controlPanel.create();
      };

      await doListen();

      // 设置页面刷新定时器
      this.listenPostTimer = setInterval(async () => {
        await doListen();
      }, CONFIG.CHECK_INTERVAL);

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

    stop() {
      if (this.listenPostTimer) {
        clearInterval(this.listenPostTimer);
        this.listenPostTimer = null;
      }

      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
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
