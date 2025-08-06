module.exports = {
  apps: [
    {
      name: "write-config-file-production",
      script: "./server.js", // 使用绝对路径
      instances: 2,
      autorestart: true,
      watch: true,
      max_memory_restart: "1G",
      max_restarts: 10, // 最大重启次数
      restart_delay: 4000, // 重启延迟
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
  ],
};
