// 端到端验收：手机屏幕 = iPhone 4s 复古模拟器
// 链路：进手机特写 → 锁屏 9:41 → 拖滑条解锁 → 主屏 20 图标 →
//       计算器真算 → 备忘录纸条 → 时钟走秒 → 地图彩蛋弹窗 → Home 键 → 退出不乱跳
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE);
    await sleep(6000); // 等房间加载

    // 1. 进手机特写
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(3500); // 等镜头动画

    const phone = page.locator('.htmlPhoneScreen > div').first();
    console.log('手机屏可见:', await phone.isVisible().catch(() => false));

    const inLock = await phone.textContent().catch(() => '');
    console.log('锁屏 9:41:', inLock.includes('9:41') ? '✓' : '✗');
    console.log('滑动来解锁:', inLock.includes('滑动来解锁') ? '✓' : '✗');

    // 2. 截锁屏图
    await page.screenshot({ path: 'evidence/iphone_lock.png' });

    // 3. 拖动滑条解锁（真实鼠标拖拽）
    const track = page.locator('.htmlPhoneScreen div[style*="cursor: grab"]');
    const tb = await track.boundingBox();
    if (tb) {
        await page.mouse.move(tb.x + 8, tb.y + tb.height / 2);
        await page.mouse.down();
        // 分步拖，触发 pointermove
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(tb.x + 8 + ((tb.width - 60) * i) / 10, tb.y + tb.height / 2);
            await sleep(30);
        }
        await page.mouse.up();
    }
    await sleep(800);
    const homeText = await phone.textContent().catch(() => '');
    console.log('解锁后进主屏(Safari):', homeText.includes('Safari') ? '✓' : '✗');
    console.log('主屏有计算器图标:', homeText.includes('计算器') ? '✓' : '✗');

    // 4. 截主屏图
    await page.screenshot({ path: 'evidence/iphone_home.png' });

    // 5. 点计算器 → 12 × 8 = 96
    const calcBtn = page.locator('.htmlPhoneScreen button').filter({ hasText: '🧮计算器' }).first();
    await calcBtn.click();
    await sleep(400);
    const keys = page.locator('.htmlPhoneScreen button');
    const pressKey = async (label) => {
        const k = page.locator('.htmlPhoneScreen button', { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
        if (await k.count()) await k.click();
        await sleep(120);
    };
    await pressKey('1'); await pressKey('2'); await pressKey('×');
    await pressKey('8'); await pressKey('=');
    const display = await page.locator('.htmlPhoneScreen div[style*="font-size: 56px"]').textContent().catch(() => '');
    console.log('计算器 12×8=', display.trim() === '96' ? '96 ✓' : `✗(${display.trim()})`);

    // 6. Home 键回主屏 → 点备忘录看纸条
    await page.locator('.htmlPhoneScreen button[title="Home"]').click();
    await sleep(400);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '📝备忘录' }).first().click();
    await sleep(400);
    const notesText = await phone.textContent().catch(() => '');
    console.log('备忘录纸条:', notesText.includes('修好了台灯') ? '✓' : '✗');

    // 7. 地图彩蛋：Home → 点地图图标 → 无网络连接弹窗
    await page.locator('.htmlPhoneScreen button[title="Home"]').click();
    await sleep(300);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '🗺地图' }).first().click();
    await sleep(400);
    const dlgText = await phone.textContent().catch(() => '');
    console.log('地图彩蛋弹窗:', dlgText.includes('无网络连接') ? '✓' : '✗');
    await page.screenshot({ path: 'evidence/iphone_map_dialog.png' });
    // 关弹窗
    await page.locator('.htmlPhoneScreen button', { hasText: '好' }).click();
    await sleep(200);

    // 8. 时钟：Home → 时钟 → 等 2 秒截图（秒针在走）
    await page.locator('.htmlPhoneScreen button[title="Home"]').click();
    await sleep(300);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '🕘时钟' }).first().click();
    await sleep(2000);
    await page.screenshot({ path: 'evidence/iphone_clock.png' });
    const clockText = await phone.textContent().catch(() => '');
    console.log('时钟 App:', clockText.includes('9:41') && clockText.includes('发布会时刻') ? '✓' : '✗');

    // 9. 验证点击不穿透：记录镜头状态，乱点手机屏 5 处
    const before = await page.evaluate(() => window.__cameraStore.getState().cameraState);
    const pb = await phone.boundingBox();
    if (pb) {
        const cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2;
        for (const [dx, dy] of [[-0.4, -0.35], [0.4, -0.35], [0, 0], [-0.4, 0.35], [0.4, 0.35]]) {
            await page.mouse.click(cx + pb.width * dx, cy + pb.height * dy);
            await sleep(300);
        }
    }
    const after = await page.evaluate(() => window.__cameraStore.getState().cameraState);
    console.log('乱点后镜头:', before, '->', after, before === after ? '✓ 没乱跳' : '✗ 穿透了！');

    // 10. 控制台错误
    console.log('控制台错误数:', errors.length);
    errors.slice(0, 5).forEach((e) => console.log('  err:', e.slice(0, 160)));

    await sleep(1500);
    await browser.close();
})();
