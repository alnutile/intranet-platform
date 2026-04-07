const https = require("https");

class GitHub {
  constructor(token) {
    this.token = token;
  }

  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "User-Agent": "SatBook/1.0",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      };
      if (body) options.headers["Content-Type"] = "application/json";

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
          } else {
            resolve(data ? JSON.parse(data) : null);
          }
        });
      });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getUser() {
    return this._request("GET", "/user");
  }

  async createRepo(name) {
    return this._request("POST", "/user/repos", {
      name,
      private: true,
      auto_init: false,
      description: "Created with Sat Book",
    });
  }

  async listRepos() {
    const repos = await this._request("GET", "/user/repos?sort=updated&per_page=50");
    return repos.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      updatedAt: r.updated_at,
    }));
  }
}

module.exports = GitHub;
