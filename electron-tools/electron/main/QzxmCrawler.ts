import { BrowserWindow, app } from "electron";
import * as fs from "fs/promises";
import * as path from "path";

interface PostInfo {
  time: string;
  content: string;
}

interface StoredPost extends PostInfo {
  sentAt: string; // 发送时间
}

class QzxmCrawler {
  private lastSeenPost: PostInfo | null = null;
  private window: BrowserWindow | null = null;
  private readonly URL =
    "https://h5.sass.zhuoshangsoft.com/pages/circle/index?teacher_code=3825633306";
  private readonly SEARCH_KEYWORD = "乾坤定势VIP个股";
  private timer: NodeJS.Timer | null = null;
  private readonly STORAGE_PATH = path.join(
    app.getPath("userData"),
    "sent_posts.json"
  );
  private sentPosts: StoredPost[] = [];

  async init(): Promise<void> {
    if (!app.isReady()) {
      await app.whenReady();
    }

    // 加载历史记录
    await this.loadSentPosts();

    // 禁用硬件加速以减少资源占用
    // app.disableHardwareAcceleration();

    console.log("init and startPeriodicCrawling");

    this.startPeriodicCrawling();
  }

  async getLatestVipStockTime(
    timeoutSeconds: number = 5000
  ): Promise<PostInfo | null> {
    try {
      this.window = new BrowserWindow({
        width: 1280,
        height: 800,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false, // 禁用后台限制
        },
      });

      // 设置 UA 避免被检测
      await this.window.webContents.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
      );

      if (!this.window) {
        throw new Error("Window not initialized");
      }

      // 加载页面
      await this.window.loadURL(this.URL);

      // 等待内容加载完成
      await new Promise((resolve) => setTimeout(resolve, timeoutSeconds));

      // 执行页面内的 JavaScript 来获取数据
      const posts = await this.window.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const results = [];
          const items = document.querySelectorAll('.trends-item');

          items.forEach((item) => {
            try {
              const contentEl = item.querySelector('.content-text');
              const timeEl = item.querySelector('.update-time');
              
              if (contentEl && timeEl) {
                const content = contentEl.textContent || '';
                const time = timeEl.textContent || '';

                if (content.includes('${this.SEARCH_KEYWORD}')) {
                  results.push({ time, content: content.trim() });
                }
              }
            } catch (err) {
              console.error('解析元素失败:', err);
            }
          });

          resolve(results);
        })
      `);

      return posts.length > 0 ? posts[0] : null;
    } catch (error) {
      console.error("抓取失败:", error);
      return null;
    } finally {
      await this.cleanup();
    }
  }

  private async loadSentPosts(): Promise<void> {
    try {
      // Check if file exists, if not create it with empty array
      try {
        await fs.access(this.STORAGE_PATH);
      } catch {
        await fs.writeFile(this.STORAGE_PATH, JSON.stringify([], null, 2));
      }

      const data = await fs.readFile(this.STORAGE_PATH, "utf-8");
      this.sentPosts = JSON.parse(data);
      console.log("loadSentPosts: ", this.sentPosts);
    } catch (error) {
      console.error("loadSentPosts error: ", error);
      // 如果文件不存在或解析失败，使用空数组
      this.sentPosts = [];
    }
  }

  private async saveSentPosts(): Promise<void> {
    try {
      // Keep only the 3 most recent posts
      this.sentPosts = this.sentPosts.slice(-3);
      await fs.writeFile(
        this.STORAGE_PATH,
        JSON.stringify(this.sentPosts, null, 2)
      );
    } catch (error) {
      console.error("保存发送记录失败:", error);
    }
  }

  private isPostAlreadySent(post: PostInfo): boolean {
    return this.sentPosts.some(
      (sentPost) =>
        sentPost.time === post.time && sentPost.content === post.content
    );
  }

  async analyzePostAndReport(posts: PostInfo | null) {
    // 检查是否有新帖子且未发送过
    if (posts && !this.isPostAlreadySent(posts)) {
      console.log("发现新帖子:", posts);

      // 发送到企业微信机器人
      try {
        const response = await fetch(
          "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=ca354bbc-102c-4676-b9e5-f0db5da6649a",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              msgtype: "text",
              text: {
                content: `发现新帖子:\n时间: ${posts.time}\n内容: ${posts.content}`,
              },
            }),
          }
        );

        const result = await response.json();
        if (result.errcode === 0) {
          // 发送成功后，记录到历史
          const storedPost: StoredPost = {
            ...posts,
            sentAt: new Date().toISOString(),
          };
          this.sentPosts.push(storedPost);
          await this.saveSentPosts();
        } else {
          console.error("发送消息失败:", result);
        }
      } catch (error) {
        console.error("发送webhook失败:", error);
      }

      this.lastSeenPost = posts;
    }
  }

  async startPeriodicCrawling(intervalSeconds: number = 30): Promise<void> {
    // 先执行一次初始抓取，这次等待 2 分钟，以方便进行登录
    const posts = await this.getLatestVipStockTime(120 * 1000);
    if (posts) {
      this.analyzePostAndReport(posts);
    }

    // 设置定期抓取
    this.timer = setInterval(async () => {
      const posts = await this.getLatestVipStockTime();
      if (posts) {
        this.analyzePostAndReport(posts);
      }
    }, intervalSeconds * 1000);
  }

  stopCrawling(): void {
    if (this.timer) {
      clearInterval(Number(this.timer));
      this.timer = null;
    }
    this.cleanup();
  }

  private async cleanup(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      await this.window.close();
      this.window = null;
    }
  }
}

// 导出实例
export const qzxmCrawler = new QzxmCrawler();
