const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const app = express();
const PORT = 8080;

app.use(bodyParser.json());

// 读取文件
app.get("/test", (req, res) => {
  if (!fs.existsSync(path)) {
    return res.status(404).json({ error: "File not found" });
  }

  return res.json({ "test get msg": "ok" });
});

// 读取文件
app.get("/read", (req, res) => {
  const { path = "" } = req.query;

  if (!fs.existsSync(path)) {
    return res.status(404).json({ error: "File not found" });
  }
  const content = fs.readFileSync(path, "utf-8");

  res.json({ message: "success", data: JSON.parse(content) });
});

// 写入文件（覆盖）
app.post("/write", (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "No content provided" });
  }

  console.log("===> content", content);

  const originContent = JSON.parse(fs.readFileSync(content.filePath, "utf-8"));

  const updatedPosts = [...originContent.posts, content.post].slice(-50);

  const finalContent = {
    updateAt: new Date().toLocaleString(),
    posts: updatedPosts,
  };

  fs.writeFileSync(content.filePath, JSON.stringify(finalContent), "utf-8");

  res.json({ status: "success" });
});

// 写入文件（覆盖）
app.post("/writeToArray", (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "No content provided" });
  }

  console.log("===> content", content);

  const originContent = JSON.parse(fs.readFileSync(content.filePath, "utf-8"));

  const logs = [...originContent.logs, { time: new Date().toLocaleString(), filePath: content.filePath, posts: content.posts }]
  const updatedPosts = [...originContent.posts, ...content.posts].slice(-80);

  console.log("====> updatedPosts", updatedPosts);

  const finalContent = {
    updateAt: new Date().toLocaleString(),
    posts: updatedPosts,
    logs
  };

  fs.writeFileSync(content.filePath, JSON.stringify(finalContent), "utf-8");

  res.json({ status: "success" });
});

// 追加内容
// app.post('/append', (req, res) => {
//     const { content } = req.body;
//     if (!content) {
//         return res.status(400).json({ error: 'No content provided' });
//     }
//     fs.appendFileSync(FILE_PATH, content + '\n', 'utf-8');
//     res.json({ status: 'success' });
// });

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
