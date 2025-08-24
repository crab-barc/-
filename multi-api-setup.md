# 多Gemini API密钥设置指南

## 概述
现在支持配置多个Gemini API密钥，系统会随机选择密钥进行调用，有效降低香港服务器分配次数。

## 配置方法

### 方法1: 使用多个环境变量 (推荐)
```bash
# 设置多个独立的API密钥
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put GEMINI_API_KEY_1 --env production  
npx wrangler secret put GEMINI_API_KEY_2 --env production
npx wrangler secret put GEMINI_API_KEY_3 --env production
# ... 最多支持10个密钥
```

### 方法2: 使用JSON格式的密钥列表
```bash
# 设置包含多个密钥的JSON字符串
npx wrangler secret put GEMINI_API_KEYS --env production
# 输入内容: ["key1", "key2", "key3"]
```

### 方法3: 混合使用
可以同时使用上述两种方法，系统会自动去重。

## 工作流程

1. **随机选择**: 系统启动时随机打乱API密钥顺序
2. **顺序尝试**: 按随机顺序尝试每个密钥
3. **智能降级**: 如果某个密钥遇到地理位置问题，立即尝试下一个
4. **模型降级**: 如果gemini-2.5-flash-lite失败，尝试gemini-2.0-flash-lite
5. **备用API**: 所有Gemini密钥都失败时，使用备用API

## 优势

- **降低香港服务器分配**: 多个密钥随机调用，减少被分配到香港服务器的概率
- **提高成功率**: 一个密钥失败时自动尝试其他密钥
- **负载均衡**: 分散API调用压力
- **向后兼容**: 原有的单密钥配置仍然有效

## 监控和日志

系统会记录详细的调用日志：
- 每个密钥的尝试情况
- 成功使用的密钥索引
- 失败原因和降级过程
- 最终使用的API来源

## 注意事项

1. 确保所有API密钥都有足够的配额
2. 建议配置3-5个密钥以获得最佳效果
3. 密钥越多，香港服务器分配概率越低
4. 系统会自动过滤无效的密钥
