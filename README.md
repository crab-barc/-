# FemboyNum - AI驱动的男娘指数分析器

> 基于 [@Akanyi/Gaynum](https://github.com/Akanyi/Gaynum) 完全重写，使用 Cursor AI 重构并加入智能AI分析功能



### 本地使用
```bash
# 克隆项目
git clone https://github.com/your-username/femboynum.git
cd femboynum

# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到Cloudflare Workers
npm run deploy
```

## 🔧 配置说明

### 环境变量
```bash
# Gemini API密钥
GEMINI_API_KEY=your_gemini_api_key

# 备用API密钥 (硅基流动)
SILICONFLOW_API_KEY=your_siliconflow_api_key

# Turnstile验证密钥 (后端验证用)
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### 支持多API密钥
```bash
# 单个密钥
GEMINI_API_KEY=key1

# 多个密钥 (自动负载均衡)
GEMINI_API_KEY_1=key1
GEMINI_API_KEY_2=key2
GEMINI_API_KEY_3=key3

# 或使用JSON数组
GEMINI_API_KEYS=["key1","key2","key3"]
```
## 🚀 部署指南

### Cloudflare Workers部署
1. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

2. **⚠️ 重要提示：部署前需要更换密钥**
   - 本项目中的 `0x4AAAAAABt7oH4As3R0PYqj` 是示例密钥，**不能直接使用**
   - 请到 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) 创建自己的站点
   - 获取真实的 `site key` 和 `secret key`

3. 配置环境变量
```bash
# 设置API密钥
wrangler secret put GEMINI_API_KEY
wrangler secret put SILICONFLOW_API_KEY

# 设置Turnstile密钥
wrangler secret put TURNSTILE_SECRET_KEY
```

4. 部署Worker
```bash
wrangler deploy
```

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

##  致谢

- 感谢 [@Akanyi](https://github.com/Akanyi) 的原始项目 [Gaynum](https://github.com/Akanyi/Gaynum)
- 感谢 [Cursor AI](https://cursor.sh/) 提供的AI编程助手
- 感谢 [Cloudflare](https://cloudflare.com/) 提供的Workers平台
- 感谢 [Google Gemini](https://ai.google.dev/) 和 [DeepSeek](https://www.deepseek.com/) 提供的AI模型和服务