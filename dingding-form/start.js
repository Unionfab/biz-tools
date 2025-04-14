const { spawn } = require("child_process");
spawn("yarn", ["start"], { stdio: "inherit", shell: true });
