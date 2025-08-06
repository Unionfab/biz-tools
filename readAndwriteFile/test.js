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

const getPostList = async () => {
  
  return  GM_xmlhttpRequest({
    method: "POST",
    url: "https://api.sass.zhuoshangsoft.com/teacher-posts/list",
    headers: {
      "accept": "*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      "content-type": "application/x-www-form-urlencoded",
      "priority": "u=1, i",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "referer": "https://h5.sass.zhuoshangsoft.com/"
    },
    data: "teacher_code=3825633306&page=1&size=10&token=27c30828a1fd47040025a457fc8e2125",
    onload: function(response) {
      console.log("Response:", response.responseText);
    },
    onerror: function(error) {
      console.error("Request failed", error);
    }
  });
} 

(function () {
  "use strict";

  // 配置常量
  const CONFIG = {
    SECRET_KEY: "乾坤定势VIP个股跟踪提醒",
    REFRESH_INTERVAL: 60 * 1000, // 30s 监测一次
    STORAGE_KEYS: {
      LAST_REFRESH: "lastRefreshDate",
      LAST_POST: "lastPostData",
      SETTINGS: "monitorSettings",
    },
    API: {
      ENDPOINT: "http://localhost:8080/write",
      HEADERS: {
        Accept: "*",
        "Content-Type": "application/json; charset=UTF-8",
      },
      UPDATE_FILE_PATH: "C:\\WorkSpace\\理财文件\\马老师\\update\\update.json",
      CONFIG_FILE_PATH: "C:\\WorkSpace\\理财文件\\马老师\\日志文件\\posts.json",
    },
    TIME_RANGE: {
      START_HOUR: 9,
      END_HOUR: 24,
      WEEKDAYS: [1, 2, 3, 4, 5], // 周一到周五
    },
  };

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

      return (
        CONFIG.TIME_RANGE.WEEKDAYS.includes(day) &&
        hour >= CONFIG.TIME_RANGE.START_HOUR &&
        hour < CONFIG.TIME_RANGE.END_HOUR
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
    
      getPostList()
    }

    isPostAlreadySent(post) {
      if (!post) return false;
      // this.loadLastPost(); // 检查前重新加载最新消息
      const latestPost = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_POST);
      return this.lastPost && this.lastPost.text === post.text;
    }

    savePost(post) {
      if (!post) return;
      utils.storage.set(CONFIG.STORAGE_KEYS.LAST_POST, post);
      this.lastPost = post;
    }

    async sendToServer(post) {
      if (!post) return;

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: CONFIG.API.ENDPOINT,
          headers: CONFIG.API.HEADERS,
          data: JSON.stringify({
            content: {
              content: post.text,
              filePath: CONFIG.API.UPDATE_FILE_PATH,
              insertAt: new Date().toLocaleString(),
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

      const refreshTime = utils.storage.get(CONFIG.STORAGE_KEYS.LAST_REFRESH);
      // this.messageHandler.loadLastPost(); // 更新前重新加载最新消息
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
            <div>上次刷新：${
              refreshTime ? utils.formatTime(new Date(refreshTime)) : "无"
            }</div>
            <h4 style="display:-webkit-box;text-overflow:ellipsis;overflow:hidden;-webkit-line-clamp:10;-webkit-box-orient:vertical">上次发帖内容：${
              lastPost?.text || "无"
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
      this.refreshTimer = null;

      // 监听新消息事件
      window.addEventListener("newPostReceived", (event) => {
        this.checkNewPosts(event.detail);
      });
    }

    async checkNewPosts(post) {
      try {
        if (!post || this.messageHandler.isPostAlreadySent(post)) {
          return;
        }

        console.log("发现新消息:", post);
        this.messageHandler.savePost(post);

        try {
          await this.messageHandler.sendToServer(post);
        } catch (error) {
          console.error("发送消息失败:", error);
          GM_notification({
            title: "错误提醒",
            text: "消息转发失败，请检查服务器状态",
            timeout: 5000,
          });
        }
      } catch (error) {
        console.error("检查新消息时出错:", error);
      }
    }

    async start() {
      if (this.isRunning) return;
      this.isRunning = true;

      const doListen = async (panelType) => {
        if (!utils.isWithinTimeRange()) {
          console.log("⛔ 不在工作时间范围");
          return;
        }

        console.log("执行定时检查:", utils.formatTime(new Date()));

        await this.messageHandler.loadLastPost()

        utils.storage.set(
          CONFIG.STORAGE_KEYS.LAST_REFRESH,
          new Date().toISOString()
        );

        if (panelType === "create") {
          this.controlPanel.create();
        } else {
          this.controlPanel.update();
        }
      };

      await doListen("create");

      // 设置页面刷新定时器
      this.refreshTimer = setInterval(() => {
        this.stop();
        window.location.reload();
      }, CONFIG.REFRESH_INTERVAL);
    }

    stop() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      this.isRunning = false;
      this.controlPanel.removeExisting();
    }
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (_method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", function () {
      if (this._url?.includes("teacher-posts/list")) {
        console.log("[XHR]", this._url);

        return;
        try {
          const response = JSON.parse(this.responseText);

          if (response && response.data && Array.isArray(response.data?.list)) {
            console.log(" response.data.list", response.data.list);

            for (const post of response.data.list) {
              if ((post?.secret_content || "").includes(CONFIG.SECRET_KEY)) {
                console.log(">>> 捕获到 vip 消息", post);
                // 触发新消息检查
                window.dispatchEvent(
                  new CustomEvent("newPostReceived", { detail: post })
                );
                break; // 找到第一个符合条件的消息后立即跳出循环
              }
            }
          }
        } catch (error) {
          console.error("处理接口返回数据时出错:", error);
        }
      }
    });
    return originalSend.apply(this, arguments);
  };

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
