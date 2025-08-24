// test-api.js - API测试脚本
// 使用方法: node test-api.js

const BASE_URL = 'https://femboy-gemini.mdog888888do.workers.dev';

async function testHealth() {
    console.log('🔍 测试健康检查端点...');
    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const data = await response.json();
        console.log('✅ 健康检查成功:', data);
        return true;
    } catch (error) {
        console.error('❌ 健康检查失败:', error);
        return false;
    }
}

async function testAnalyze() {
    console.log('🔍 测试深度分析端点...');
    try {
        const response = await fetch(`${BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '测试', score: 75 })
        });
        
        const data = await response.json();
        console.log('📊 响应状态:', response.status);
        console.log('📄 响应数据:', data);
        
        if (response.ok && data.success) {
            console.log('✅ 深度分析成功!');
            return true;
        } else {
            console.log('❌ 深度分析失败:', data.message || '未知错误');
            
            // 显示详细的错误信息
            if (data.error === 'Configuration Error') {
                console.log('🔍 错误类型: 配置错误');
                if (data.details) {
                    console.log('📋 详细信息:', data.details);
                }
                if (data.solution) {
                    console.log('💡 解决方案:', data.solution);
                }
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ 深度分析请求失败:', error);
        return false;
    }
}

async function testStaticAssets() {
    console.log('🔍 测试静态资源...');
    try {
        const response = await fetch(`${BASE_URL}/`);
        console.log('📊 主页响应状态:', response.status);
        if (response.ok) {
            console.log('✅ 静态资源正常');
            return true;
        } else {
            console.log('❌ 静态资源异常');
            return false;
        }
    } catch (error) {
        console.error('❌ 静态资源测试失败:', error);
        return false;
    }
}

async function runTests() {
    console.log('🚀 开始API测试...\n');
    
    const healthOk = await testHealth();
    console.log('');
    
    const analyzeOk = await testAnalyze();
    console.log('');
    
    const assetsOk = await testStaticAssets();
    console.log('');
    
    console.log('📋 测试结果总结:');
    console.log(`健康检查: ${healthOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`深度分析: ${analyzeOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`静态资源: ${assetsOk ? '✅ 通过' : '❌ 失败'}`);
    
    if (!analyzeOk) {
        console.log('\n💡 深度分析失败的可能原因:');
        console.log('1. Gemini API密钥未设置');
        console.log('2. API密钥无效或过期');
        console.log('3. Worker代码错误');
        console.log('4. 网络连接问题');
        
        console.log('\n🔧 建议的解决步骤:');
        console.log('1. 检查API密钥: npx wrangler secret list --env production');
        console.log('2. 重新设置密钥: npx wrangler secret put GEMINI_API_KEY --env production');
        console.log('3. 查看日志: npx wrangler tail --env production');
    }
}

// 运行测试
runTests().catch(console.error);
