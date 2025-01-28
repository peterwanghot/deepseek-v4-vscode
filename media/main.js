const vscode = acquireVsCodeApi();

// 提交按钮点击事件
document.getElementById('submit').addEventListener('click', () => {
    const prompt = document.getElementById('prompt').value;
    if (prompt) {
        // 显示加载动画
        document.getElementById('loader').style.display = 'block';
        // 清空输出区域
        document.getElementById('output').innerText = '';
        // 发送消息给扩展
        vscode.postMessage({
            command: 'generateCode',
            text: prompt
        });
    }
});

// 监听来自扩展的消息
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'codeGenerated':
            // 隐藏加载动画
            document.getElementById('loader').style.display = 'none';
            // 显示生成的代码
            const outputElement = document.getElementById('output');
            outputElement.innerHTML = '<pre><code>' + message.code + '</code></pre>';
            hljs.highlightElement(outputElement.querySelector('code'));
            break;
        case 'error':
            // 隐藏加载动画
            document.getElementById('loader').style.display = 'none';
            // 显示错误消息
            document.getElementById('output').innerText = message.message;
            break;
        case 'loading':
            // 控制加载动画的显示与隐藏
            document.getElementById('loader').style.display = message.loading ? 'block' : 'none';
            break;
    }
});