/**
 * iPhone 4s 复古模拟器 —— 数据与纯逻辑层。
 *
 * 这个文件不含任何 React/Three.js 代码，方便单元测试：
 * - HOME_ICONS / DOCK_ICONS：主屏与 Dock 的图标表
 * - dialogFor：点图标弹什么窗（真 App 不弹，地图弹「无网络连接」，装饰弹占位）
 * - NOTES：备忘录里预存的纸条（呼应这个 3D 房间）
 * - createCalculator：iOS 4 经典计算器引擎（立即执行逻辑：2+3×4=20）
 * - LOCK_TIME：所有时间一律 9:41 —— Apple 发布会经典的"产品发布时刻"
 */

/** 锁屏与状态栏显示的时间（发布会梗：产品照片永远停在 9:41） */
export const LOCK_TIME = '9:41';

/** 锁屏日期：也照搬发布会常用的星期二 */
export const LOCK_DATE = '星期二 二月 8';

/**
 * 主屏 4×4 图标。
 * kind 说明：
 *  - 'app'  真做出来的应用（时钟/备忘录/计算器），点开有真界面
 *  - 'map'  地图彩蛋，点开弹「无网络连接」（4s 时代的日常）
 *  - 'deco' 纯装饰，点开弹「不可用」占位窗
 */
export const HOME_ICONS = [
    { id: 'messages', name: '信息', kind: 'deco' },
    { id: 'calendar', name: '日历', kind: 'deco' },
    { id: 'photos', name: '照片', kind: 'deco' },
    { id: 'camera', name: '相机', kind: 'deco' },
    { id: 'youtube', name: 'YouTube', kind: 'deco' },
    { id: 'stocks', name: '股市', kind: 'deco' },
    { id: 'maps', name: '地图', kind: 'map' },
    { id: 'weather', name: '天气', kind: 'deco' },
    { id: 'voice-memos', name: '语音备忘录', kind: 'deco' },
    { id: 'clock', name: '时钟', kind: 'app' },
    { id: 'calculator', name: '计算器', kind: 'app' },
    { id: 'notes', name: '备忘录', kind: 'app' },
    { id: 'compass', name: '指南针', kind: 'deco' },
    { id: 'settings', name: '设置', kind: 'deco' },
    { id: 'itunes', name: 'iTunes', kind: 'deco' },
    { id: 'app-store', name: 'App Store', kind: 'deco' }
];

/** 底部 Dock 4 个图标（4s 时代固定：电话/邮件/iPod/Safari） */
export const DOCK_ICONS = [
    { id: 'phone', name: '电话', kind: 'deco' },
    { id: 'mail', name: '邮件', kind: 'deco' },
    { id: 'ipod', name: 'iPod', kind: 'deco' },
    { id: 'safari', name: 'Safari', kind: 'deco' }
];

/**
 * 点图标该弹什么窗。
 * 真 App（kind='app'）返回 null 不弹；地图弹经典「无网络连接」；
 * 装饰图标弹「不可用」占位。
 */
export function dialogFor(icon) {
    if (icon.kind === 'app') return null;
    if (icon.kind === 'map') {
        return {
            title: '无网络连接',
            body: '需要连接到 Wi-Fi 或蜂窝网络才能使用地图。此功能在 3D 房间小宇宙中不可用。'
        };
    }
    return {
        title: `「${icon.name}」不可用`,
        body: '这台复古 iPhone 4s 里只有时钟、计算器和备忘录是活的，其他都是 2010 年的回忆。'
    };
}

/** 备忘录预存纸条（呼应这个 3D 房间作品集） */
export const NOTES = [
    {
        title: '修好了台灯',
        body: '灯泡换成暖橙色的，晚上写代码不刺眼了。就是房间里那盏矮矮的。'
    },
    {
        title: '显示器里的视频',
        body: '点桌面显示器会自动播 B 站视频，记得换成自己喜欢的（改 desktopiFrame.jsx 里的地址就行）。'
    },
    {
        title: '房间清单',
        body: '6 个物件都摆好了：显示器、手机、电视、笔记本、音响，还有那盏台灯。电视里是马里奥，笔记本里是网易云。'
    },
    {
        title: '关于这台手机',
        body: '2010 年的发布会记忆。时间永远停在 9:41 —— 那是 Apple 产品照片的仪式感。'
    },
    {
        title: '待办',
        body: '把最喜欢的一个项目讲给来看房间的朋友听。'
    }
];

/* -------------------------------------------------------------------------
 * iOS 4 计算器引擎
 *
 * 经典「立即执行」逻辑（不是数学优先级）：
 *   按 2 + 3 × 4 = 时，按完 × 已经把 2+3=5 算掉，再 ×4，最终 20。
 * 这正是 iPhone 4s 那个计算器的行为。
 *
 * press(键) 返回屏幕应显示的字符串；display 是只读属性。
 * 支持的键：0-9、.、+、-、×、÷、=、C、±、%
 * ------------------------------------------------------------------------- */

const OPS = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '×': (a, b) => a * b,
    '÷': (a, b) => (b === 0 ? null : a / b) // 除 0 → null → 显示「错误」
};

/** 数值转显示字符串：抹掉浮点尾差（0.1+0.2 → 0.3），最多 10 位有效数字 */
function formatNumber(n) {
    if (!isFinite(n)) return '错误';
    return String(parseFloat(n.toPrecision(10)));
}

export function createCalculator() {
    let display = '0'; // 屏幕上显示的内容
    let entry = '0'; // 正在输入（或刚得出）的数
    let fresh = true; // 下一个数字键是否开启新数
    let acc = null; // 累加器（左操作数）
    let op = null; // 待执行的运算符
    let error = false;

    function reset() {
        display = '0';
        entry = '0';
        fresh = true;
        acc = null;
        op = null;
        error = false;
    }

    function press(key) {
        // 出错后：数字键 → 清零重来并输入该数字；其他键 → 清零
        if (error) {
            reset();
            if (!/^[0-9]$/.test(key)) return display;
        }

        // 数字
        if (/^[0-9]$/.test(key)) {
            const digits = entry.replace(/[-.]/g, '').length;
            if (fresh) {
                entry = key;
                fresh = false;
            } else if (digits < 9) {
                entry = entry === '0' ? key : entry + key;
            }
            display = entry;
            return display;
        }

        // 小数点
        if (key === '.') {
            if (fresh) {
                entry = '0.';
                fresh = false;
            } else if (!entry.includes('.')) {
                entry += '.';
            }
            display = entry;
            return display;
        }

        // 运算符
        if (key in OPS) {
            if (op !== null && !fresh) {
                // 连续运算：先把上一步算掉（立即执行）
                const r = OPS[op](acc, parseFloat(entry));
                if (r === null || !isFinite(r)) {
                    error = true;
                    display = '错误';
                    return display;
                }
                acc = r;
                display = formatNumber(r);
                entry = display;
            } else if (op === null) {
                acc = parseFloat(entry);
            }
            // op !== null && fresh：只是换运算符，不动数值
            op = key;
            fresh = true;
            return display;
        }

        // 等号
        if (key === '=') {
            if (op !== null) {
                const r = OPS[op](acc, parseFloat(entry));
                if (r === null || !isFinite(r)) {
                    error = true;
                    display = '错误';
                    return display;
                }
                display = formatNumber(r);
                entry = display;
                acc = null;
                op = null;
                fresh = true;
            }
            return display;
        }

        // 清零
        if (key === 'C') {
            reset();
            return display;
        }

        // 正负号
        if (key === '±') {
            if (entry.startsWith('-')) entry = entry.slice(1);
            else if (parseFloat(entry) !== 0) entry = '-' + entry;
            fresh = false;
            display = entry;
            return display;
        }

        // 百分比
        if (key === '%') {
            entry = formatNumber(parseFloat(entry) / 100);
            display = entry;
            fresh = false;
            return display;
        }

        // 未知键：忽略
        return display;
    }

    return {
        press,
        get display() {
            return display;
        }
    };
}
