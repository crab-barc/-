// debug-api.js
// 调试API调用的脚本

const WORKER_URL = 'https://femboy-gemini.mdog888888do.workers.dev';

async function testAPI() {
    console.log('🧪 开始测试API...');
    
    try {
        // 测试健康检查
        console.log('\n1️⃣ 测试健康检查...');
        const healthResponse = await fetch(`${WORKER_URL}/api/health`);
        const healthData = await healthResponse.json();
        console.log('健康检查结果:', healthData);
        
        // 测试深度分析
        console.log('\n2️⃣ 测试深度分析...');
        const analyzeResponse = await fetch(`${WORKER_URL}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: '测试名字', 
                score: 75 
            })
        });
        
        console.log('响应状态:', analyzeResponse.status, analyzeResponse.statusText);
        console.log('响应头:', Object.fromEntries(analyzeResponse.headers.entries()));
        
        const analyzeData = await analyzeResponse.json();
        console.log('深度分析结果:', analyzeData);
        
        if (analyzeData.success) {
            console.log('✅ API调用成功');
            console.log('分析内容:', analyzeData.analysis);
            console.log('元数据:', analyzeData.metadata);
        } else {
            console.log('❌ API调用失败');
            console.log('错误信息:', analyzeData);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error('错误详情:', error.message);
    }
}

// 运行测试
testAPI();
