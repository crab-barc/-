// src/worker.js
// Cloudflare Worker 后端服务

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      // API 路由处理
      if (url.pathname === "/api/analyze" && method === "POST") {
        return await handleAnalyze(request, env);
      }
      
      if (url.pathname === "/api/health" && method === "GET") {
        return handleHealth();
      }

      // 兼容旧版本的 /analyze 路径
      if (url.pathname === "/analyze" && method === "POST") {
        return await handleAnalyze(request, env);
      }

      // 处理favicon.ico请求
      if (url.pathname === "/favicon.ico") {
        console.log(`[${new Date().toISOString()}] 处理favicon.ico请求`);
        // 返回一个简单的SVG图标，避免404错误
        const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32">
          <circle cx="50" cy="50" r="45" fill="#8b5cf6" stroke="#6d28d9" stroke-width="2"/>
          <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="white">🎭</text>
        </svg>`;
        return new Response(svgIcon, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400' // 缓存24小时
          }
        });
      }

      // 静态资源处理
      if (env.ASSETS) {
        try {
          return await env.ASSETS.fetch(request);
        } catch (assetsError) {
          console.error('静态资源获取失败:', assetsError);
          // 如果静态资源获取失败，返回404
          return new Response('Not Found', { status: 404 });
        }
      } else {
        console.error('ASSETS 绑定未找到');
        // 如果没有ASSETS绑定，返回404
        return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: '服务器内部错误',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
  }
};

// 获取客户端IP地址
function getClientIP(request) {
  // 尝试从CF-Connecting-IP获取真实IP
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;
  
  // 尝试从X-Forwarded-For获取
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  
  // 尝试从X-Real-IP获取
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  // 最后尝试从CF-Connecting-IP获取
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// 验证Turnstile令牌
async function verifyTurnstile(token, clientIP, secretKey) {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', clientIP);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Turnstile验证失败:', error);
    return false;
  }
}

// 处理 CORS
function handleCORS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, CF-Turnstile-Response',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 健康检查端点
function handleHealth() {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'femboy-gemini-worker',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 处理深度分析请求
async function handleAnalyze(request, env) {
  try {
    // 获取客户端IP
    const clientIP = getClientIP(request);
    console.log(`[${new Date().toISOString()}] 请求来自IP: ${clientIP}`);
    
    // 验证请求体
    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: '名字参数是必需的且必须是字符串'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!body.score || typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: '分数参数是必需的且必须在0-100之间'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 检查名字是否包含违禁词
    if (containsForbiddenWords(body.name)) {
      console.log(`[${new Date().toISOString()}] 名字包含违禁词: ${body.name}`);
      return new Response(JSON.stringify({
        success: false,
        message: '这个名字好像不太好分析呢，换个名字吧',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 检查 API 密钥
    const geminiApiKeys = getGeminiApiKeys(env);
    if (geminiApiKeys.length === 0) {
      console.error(`[${new Date().toISOString()}] 没有可用的Gemini API密钥`);
      return new Response(JSON.stringify({
        error: 'Configuration Error',
        message: 'Gemini API 密钥未配置',
        details: '请在Cloudflare Dashboard中设置GEMINI_API_KEY环境变量，或使用命令：npx wrangler secret put GEMINI_API_KEY --env production',
        solution: '设置API密钥后重新部署Worker即可解决问题',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 检查Turnstile配置
    if (!env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY === 'your_turnstile_secret_key_here') {
      console.error(`[${new Date().toISOString()}] Turnstile 密钥未配置`);
      return new Response(JSON.stringify({
        error: 'Configuration Error',
        message: 'Turnstile 验证密钥未配置',
        details: '请在Cloudflare Dashboard中设置TURNSTILE_SECRET_KEY环境变量',
        solution: '设置Turnstile密钥后重新部署Worker即可解决问题',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const { name, score, turnstileToken } = body;
    
    // 检查是否需要Turnstile验证
    const requestCount = await getRequestCount(clientIP);
    console.log(`[${new Date().toISOString()}] IP ${clientIP} 的请求次数: ${requestCount}`);
    
    if (requestCount >= 3) {
      // 超过3次，需要验证Turnstile
      if (!turnstileToken) {
        return new Response(JSON.stringify({
          error: 'Turnstile Required',
          message: '请求次数过多，需要进行人机验证',
          details: '请在请求中包含有效的Turnstile令牌',
          solution: '在前端添加Turnstile验证组件',
          timestamp: new Date().toISOString()
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 验证Turnstile令牌
      const isValidToken = await verifyTurnstile(turnstileToken, clientIP, env.TURNSTILE_SECRET_KEY);
      if (!isValidToken) {
        return new Response(JSON.stringify({
          error: 'Turnstile Invalid',
          message: '人机验证失败',
          details: '请重新完成验证',
          solution: '刷新页面重新验证',
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // 验证成功，重置计数器
      await resetRequestCount(clientIP);
      console.log(`[${new Date().toISOString()}] IP ${clientIP} 验证成功，重置计数器`);
    } else {
      // 未超过3次，增加计数
      await incrementRequestCount(clientIP);
      console.log(`[${new Date().toISOString()}] IP ${clientIP} 请求计数增加`);
    }
    
    // 构建更智能的提示词
    const prompt = buildAnalysisPrompt(name, score);
    
                  // 智能调用API，支持多Gemini API随机调用和自动降级
      const apiResult = await callAIAPI(prompt, geminiApiKeys, env.SILICONFLOW_API_KEY);
    
    console.log(`[${new Date().toISOString()}] 返回分析结果:`, apiResult.result);
    
    return new Response(JSON.stringify({
      success: true,
      analysis: apiResult.result,
      metadata: {
        name: name,
        score: score,
        timestamp: new Date().toISOString(),
        model: apiResult.model,
        source: apiResult.source
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // 缓存5分钟
      }
    });

  } catch (error) {
    console.error('Analyze error:', error);
    
    if (error.name === 'SyntaxError') {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: '请求体格式错误，请检查JSON格式'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 检查是否是地理位置错误
    if (error.errorType === 'LOCATION_ERROR') {
      return new Response(JSON.stringify({
        error: 'Location Error',
        message: error.message,
        details: error.message.split(': ')[1] || '地理位置不支持',
        solution: '你可能被分配到了香港服务器，请刷新或尝试调整网络环境',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: '分析生成失败，请稍后再试',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 构建分析提示词
function buildAnalysisPrompt(name, score) {
  const scoreLevel = getScoreLevel(score);
  const personalityTraits = getPersonalityTraits(score);
  
  return `请为以下名字生成一段有趣的"男娘特点个性化解析"：

名字：${name}
男娘指数：${score}%
指数等级：${scoreLevel}
性格特征：${personalityTraits}

要求：
1. 语言风格：轻松幽默，带有二次元风格
2. 内容长度：100-150字
3. 结合名字特点和指数分数进行分析
4. 包含具体的建议和鼓励
5. 避免过于刻板或冒犯性的描述

请生成一段有趣且个性化的分析：`;
}

// 获取分数等级
function getScoreLevel(score) {
  if (score < 20) return "纯爷们级别";
  if (score < 40) return "直男可爱级别";
  if (score < 60) return "中性风格级别";
  if (score < 80) return "男娘潜力级别";
  if (score < 90) return "男娘爆发级别";
  return "完美男娘级别";
}

// 获取性格特征
function getPersonalityTraits(score) {
  if (score < 20) return "阳刚、直率、传统";
  if (score < 40) return "可爱、温和、友善";
  if (score < 60) return "中性、平衡、灵活";
  if (score < 80) return "精致、细腻、敏感";
  if (score < 90) return "优雅、迷人、独特";
  return "完美、和谐、平衡";
}

// 调用 Gemini API
async function callGeminiAPI(prompt, apiKey, model = 'gemini-2.5-flash-lite') {
  console.log(`[${new Date().toISOString()}] 开始调用 Gemini API (${model})`);
  
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[${new Date().toISOString()}] 请求 Gemini API:`, apiUrl);
    
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 300
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
    
    console.log(`[${new Date().toISOString()}] 请求体:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[${new Date().toISOString()}] Gemini API 响应状态:`, response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[${new Date().toISOString()}] Gemini API 错误:`, response.status, errorData);
      
      // 尝试解析错误响应
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        parsedError = { error: { message: errorData } };
      }
      
      // 根据不同的HTTP状态码提供具体的错误信息
      let errorMessage = 'Gemini API 请求失败';
      let errorDetails = '';
      let errorType = 'API_ERROR';
      
      // 检查特定的地理位置错误
      if (response.status === 400 && parsedError.error && parsedError.error.message && 
          parsedError.error.message.includes('User location is not supported')) {
        errorMessage = '地理位置不支持';
        errorDetails = '你可能被分配到了香港服务器，请尝试调整网络环境';
        errorType = 'LOCATION_ERROR';
      } else {
        // 其他错误的处理
        switch (response.status) {
          case 400:
            errorMessage = 'Gemini API 请求参数错误';
            errorDetails = '请检查请求内容是否符合API要求';
            break;
          case 401:
            errorMessage = 'Gemini API 密钥无效';
            errorDetails = '请检查API密钥是否正确设置，或密钥是否已过期';
            break;
          case 403:
            errorMessage = 'Gemini API 访问被拒绝';
            errorDetails = '请检查API密钥权限或配额是否足够';
            break;
          case 429:
            errorMessage = 'Gemini API 请求过于频繁';
            errorDetails = '请稍后再试，或检查API配额使用情况';
            break;
          case 500:
            errorMessage = 'Gemini API 服务器内部错误';
            errorDetails = '这是Google服务器的问题，请稍后再试';
            break;
          default:
            errorDetails = `HTTP状态码: ${response.status}`;
        }
      }
      
      const error = new Error(`${errorMessage}: ${errorDetails}`);
      error.errorType = errorType;
      throw error;
    }

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Gemini API 响应数据:`, JSON.stringify(data, null, 2));
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error(`[${new Date().toISOString()}] Gemini API 响应格式错误:`, data);
      throw new Error(`Gemini API 响应格式错误: 缺少candidates或content字段`);
    }

    const text = data.candidates[0].content.parts[0].text;
    
    if (!text || text.trim().length === 0) {
      console.error(`[${new Date().toISOString()}] Gemini API 返回内容为空`);
      throw new Error('Gemini API 返回内容为空');
    }

    console.log(`[${new Date().toISOString()}] Gemini API 调用成功，返回文本长度:`, text.length);
    return text.trim();
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Gemini API 调用失败:`, error);
    throw error;
  }
}

// 调用备用 API (硅基流动)
async function callBackupAPI(prompt, apiKey) {
  console.log(`[${new Date().toISOString()}] 开始调用备用 API (硅基流动)`);
  
  try {
    const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
    console.log(`[${new Date().toISOString()}] 请求备用 API:`, apiUrl);
    
    const requestBody = {
      model: "deepseek-ai/DeepSeek-V3",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.8,
      top_p: 0.95
    };
    
    console.log(`[${new Date().toISOString()}] 备用API请求体:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[${new Date().toISOString()}] 备用API响应状态:`, response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[${new Date().toISOString()}] 备用API错误:`, response.status, errorData);
      
      let errorMessage = '备用API请求失败';
      let errorDetails = '';
      
      switch (response.status) {
        case 400:
          errorMessage = '备用API请求参数错误';
          errorDetails = '请检查请求内容是否符合API要求';
          break;
        case 401:
          errorMessage = '备用API密钥无效';
          errorDetails = '请检查API密钥是否正确设置';
          break;
        case 403:
          errorMessage = '备用API访问被拒绝';
          errorDetails = '请检查API密钥权限或配额是否足够';
          break;
        case 429:
          errorMessage = '备用API请求过于频繁';
          errorDetails = '请稍后再试';
          break;
        case 500:
          errorMessage = '备用API服务器内部错误';
          errorDetails = '这是服务器的问题，请稍后再试';
          break;
        default:
          errorDetails = `HTTP状态码: ${response.status}`;
      }
      
      throw new Error(`${errorMessage}: ${errorDetails}`);
    }

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] 备用API响应数据:`, JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error(`[${new Date().toISOString()}] 备用API响应格式错误:`, data);
      throw new Error(`备用API响应格式错误: 缺少choices或message字段`);
    }

    const text = data.choices[0].message.content;
    
    if (!text || text.trim().length === 0) {
      console.error(`[${new Date().toISOString()}] 备用API返回内容为空`);
      throw new Error('备用API返回内容为空');
    }

    console.log(`[${new Date().toISOString()}] 备用API调用成功，返回文本长度:`, text.length);
    return text.trim();
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 备用API调用失败:`, error);
    throw error;
  }
}

// 智能API调用函数，支持多Gemini API随机调用和自动降级
async function callAIAPI(prompt, primaryApiKeys, backupApiKey) {
  console.log(`[${new Date().toISOString()}] 开始智能API调用`);
  
  // 将单个API密钥转换为数组格式，保持向后兼容
  const geminiApiKeys = Array.isArray(primaryApiKeys) ? primaryApiKeys : [primaryApiKeys];
  const validGeminiKeys = geminiApiKeys.filter(key => key && key !== 'your_api_key_here');
  
  if (validGeminiKeys.length === 0) {
    throw new Error('没有可用的Gemini API密钥');
  }
  
  // 随机打乱API密钥顺序，降低香港服务器分配概率
  const shuffledKeys = [...validGeminiKeys].sort(() => Math.random() - 0.5);
  console.log(`[${new Date().toISOString()}] 随机排序后的API密钥数量: ${shuffledKeys.length}`);
  
  // 记录是否遇到地理位置错误
  let hasLocationError = false;
  
  // 尝试所有可用的Gemini API密钥
  for (let i = 0; i < shuffledKeys.length; i++) {
    const currentKey = shuffledKeys[i];
    const keyIndex = i + 1;
    
    try {
      console.log(`[${new Date().toISOString()}] 尝试第${keyIndex}个Gemini API密钥 (${currentKey.substring(0, 8)}...)`);
      
      // 首先尝试 gemini-2.5-flash-lite
      try {
        const result = await callGeminiAPI(prompt, currentKey, 'gemini-2.5-flash-lite');
        console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥调用成功 (gemini-2.5-flash-lite)`);
        return {
          result: result,
          source: 'gemini',
          model: 'gemini-2.5-flash-lite',
          keyIndex: keyIndex
        };
      } catch (error) {
        console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥的gemini-2.5-flash-lite调用失败:`, error.message);
        
        // 如果是地理位置错误，记录并直接跳出循环，不再尝试任何Gemini密钥
        if (error.errorType === 'LOCATION_ERROR') {
          hasLocationError = true;
          console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥遇到地理位置问题，停止尝试所有Gemini密钥，直接使用备用API`);
          break;
        }
        
        // 只有在非地理位置错误时才尝试内部降级到 gemini-2.0-flash-lite
        if (shouldTryGeminiFallback(error)) {
          try {
            console.log(`[${new Date().toISOString()}] 尝试第${keyIndex}个API密钥的Gemini内部降级 (2.0 Flash Lite)`);
            const fallbackResult = await callGeminiAPI(prompt, currentKey, 'gemini-2.0-flash-lite');
            console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥的内部降级成功`);
            return {
              result: fallbackResult,
              source: 'gemini',
              model: 'gemini-2.0-flash-lite',
              keyIndex: keyIndex
            };
          } catch (fallbackError) {
            console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥的内部降级失败:`, fallbackError.message);
            // 继续尝试下一个密钥
            continue;
          }
        }
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] 第${keyIndex}个API密钥完全失败:`, error.message);
      // 继续尝试下一个密钥
      continue;
    }
  }
  
  // 如果遇到地理位置错误，直接降级到备用API，不再尝试任何Gemini密钥
  if (hasLocationError && backupApiKey) {
    console.log(`[${new Date().toISOString()}] 检测到地理位置错误，直接降级到备用API，完全跳过所有Gemini尝试`);
    try {
      const backupResult = await callBackupAPI(prompt, backupApiKey);
      console.log(`[${new Date().toISOString()}] 备用API调用成功`);
      return {
        result: backupResult,
        source: 'backup',
        model: 'DeepSeek-V3',
        keyIndex: 'backup'
      };
    } catch (backupError) {
      console.error(`[${new Date().toISOString()}] 备用API也失败了:`, backupError.message);
      throw new Error(`地理位置错误且备用API失败: ${backupError.message}`);
    }
  }
  
  // 如果没有地理位置错误但所有Gemini API密钥都失败了，尝试备用API
  console.log(`[${new Date().toISOString()}] 所有Gemini API密钥都失败了，开始降级到备用API`);
  
  if (backupApiKey) {
    try {
      const backupResult = await callBackupAPI(prompt, backupApiKey);
      console.log(`[${new Date().toISOString()}] 备用API调用成功`);
      return {
        result: backupResult,
        source: 'backup',
        model: 'DeepSeek-V3',
        keyIndex: 'backup'
      };
    } catch (backupError) {
      console.error(`[${new Date().toISOString()}] 备用API也失败了:`, backupError.message);
      // 抛出最后一个Gemini API的错误
      throw new Error(`所有API都失败了。最后一个Gemini错误: ${backupError.message}`);
    }
  } else {
    // 没有备用API，抛出错误
    throw new Error('所有Gemini API密钥都失败了，且没有配置备用API');
  }
}

// 判断是否应该尝试Gemini内部降级
function shouldTryGeminiFallback(error) {
  // 如果是地理位置错误，不尝试内部降级（直接使用备用API）
  if (error.errorType === 'LOCATION_ERROR') {
    return false;
  }
  
  // 如果是频率限制、配额不足、服务器错误等，尝试内部降级
  if (error.message.includes('请求过于频繁') || 
      error.message.includes('配额') ||
      error.message.includes('服务器内部错误') ||
      error.message.includes('访问被拒绝')) {
    return true;
  }
  
  // 其他错误不尝试内部降级
  return false;
}

// 判断是否应该降级到备用API
function shouldFallbackToBackup(error) {
  // 如果是地理位置错误，应该降级（使用国内API解决）
  if (error.errorType === 'LOCATION_ERROR') {
    return true;
  }
  
  // 如果是频率限制、配额不足、服务器错误等，应该降级
  if (error.message.includes('请求过于频繁') || 
      error.message.includes('配额') ||
      error.message.includes('服务器内部错误') ||
      error.message.includes('访问被拒绝')) {
    return true;
  }
  
  // 其他错误不降级
  return false;
}

// IP请求计数管理（使用内存存储，生产环境建议使用KV存储）
const ipRequestCounts = new Map();

// 获取IP请求次数
async function getRequestCount(ip) {
  const count = ipRequestCounts.get(ip);
  if (!count) return 0;
  
  // 检查是否过期（24小时）
  if (Date.now() - count.timestamp > 24 * 60 * 60 * 1000) {
    ipRequestCounts.delete(ip);
    return 0;
  }
  
  return count.count;
}

// 增加IP请求次数
async function incrementRequestCount(ip) {
  const current = await getRequestCount(ip);
  ipRequestCounts.set(ip, {
    count: current + 1,
    timestamp: Date.now()
  });
}

// 重置IP请求次数
async function resetRequestCount(ip) {
  ipRequestCounts.delete(ip);
}

// 获取Gemini API密钥列表
function getGeminiApiKeys(env) {
  const keys = [];
  
  // 支持单个密钥 (向后兼容)
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'your_api_key_here') {
    keys.push(env.GEMINI_API_KEY);
  }
  
  // 支持多个密钥 (GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...)
  for (let i = 1; i <= 10; i++) {
    const keyName = `GEMINI_API_KEY_${i}`;
    if (env[keyName] && env[keyName] !== 'your_api_key_here') {
      keys.push(env[keyName]);
    }
  }
  
  // 支持密钥列表 (GEMINI_API_KEYS)
  if (env.GEMINI_API_KEYS) {
    try {
      const keyList = JSON.parse(env.GEMINI_API_KEYS);
      if (Array.isArray(keyList)) {
        keyList.forEach(key => {
          if (key && key !== 'your_api_key_here' && !keys.includes(key)) {
            keys.push(key);
          }
        });
      }
    } catch (error) {
      console.error('解析GEMINI_API_KEYS失败:', error);
    }
  }
  
  console.log(`[${new Date().toISOString()}] 找到 ${keys.length} 个可用的Gemini API密钥`);
  return keys;
}

// 检查名字是否包含违禁词
function containsForbiddenWords(name) {
  // 违禁词列表
  const forbiddenWords = [
    // 政治敏感词
    '习近平', '毛泽东', '邓小平', '江泽民', '胡锦涛', '温家宝', '李克强',
    '共产党', '国民党', '民进党', '台独', '藏独', '疆独', '港独',
    '六四', '天安门', '法轮功', '邪教', '反动', '颠覆',  
  ];
  
  // 将名字转换为小写进行匹配
  const lowerName = name.toLowerCase();
  
  // 检查是否包含任何违禁词
  for (const word of forbiddenWords) {
    if (lowerName.includes(word.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

