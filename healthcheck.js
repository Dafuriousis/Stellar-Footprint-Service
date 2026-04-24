const http = require("http");

const options = {
  host: "localhost",
  port: process.env.PORT || 3000,
  path: "/api/health",
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.warn(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on("error", (err) => {
  console.log("ERROR:", err.message);
  console.log("ERROR:", err.message);
  console.error("ERROR:", err.message);
  console.error("ERROR:", err.message);
  process.exit(1);
});

request.end();
