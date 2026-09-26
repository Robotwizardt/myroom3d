import { describe, expect, it } from 'vitest';

import {
    createCalculator,
    dialogFor,
    DOCK_ICONS,
    HOME_ICONS,
    LOCK_TIME,
    NOTES
} from '../data/iphone4s';

describe('iPhone 4s 数据', () => {
    it('时间永远停在 9:41（发布会梗）', () => {
        expect(LOCK_TIME).toBe('9:41');
    });

    it('主屏 16 个图标 + Dock 4 个，id 不重复', () => {
        expect(HOME_ICONS).toHaveLength(16);
        expect(DOCK_ICONS).toHaveLength(4);
        const ids = [...HOME_ICONS, ...DOCK_ICONS].map((i) => i.id);
        expect(new Set(ids).size).toBe(20);
    });

    it('三个真 App（时钟/备忘录/计算器）+ 地图彩蛋在主屏上', () => {
        const apps = HOME_ICONS.filter((i) => i.kind === 'app').map((i) => i.id);
        expect(apps).toContain('clock');
        expect(apps).toContain('notes');
        expect(apps).toContain('calculator');
        const map = HOME_ICONS.find((i) => i.id === 'maps');
        expect(map.kind).toBe('map');
    });

    it('备忘录预存 4 条以上纸条，每条有标题和正文', () => {
        expect(NOTES.length).toBeGreaterThanOrEqual(4);
        NOTES.forEach((n) => {
            expect(n.title).toBeTruthy();
            expect(n.body).toBeTruthy();
        });
    });

    it('弹窗规则：地图弹无网络连接，装饰图标弹不可用，真 App 不弹', () => {
        expect(dialogFor({ id: 'maps', name: '地图', kind: 'map' }).title).toBe(
            '无网络连接'
        );
        const deco = dialogFor({ id: 'settings', name: '设置', kind: 'deco' });
        expect(deco.title).toContain('设置');
        expect(deco.title).toContain('不可用');
        expect(dialogFor({ id: 'clock', name: '时钟', kind: 'app' })).toBeNull();
    });
});

describe('iPhone 4s 计算器引擎', () => {
    it('基础四则运算', () => {
        expect(press('1 + 2 =')).toBe('3');
        expect(press('5 - 8 =')).toBe('-3');
        expect(press('7 × 8 =')).toBe('56');
        expect(press('5 ÷ 2 =')).toBe('2.5');
    });

    it('连续运算：2 + 3 × 4 按经典计算器逻辑等于 20', () => {
        expect(press('2 + 3 × 4 =')).toBe('20');
    });

    it('小数运算不出现 0.30000000000000004', () => {
        expect(press('0.1 + 0.2 =')).toBe('0.3');
    });

    it('C 清零，± 取反，% 百分比', () => {
        const calc = createCalculator();
        calc.press('1');
        calc.press('2');
        expect(calc.press('C')).toBe('0');
        expect(calc.press('5')).toBe('5');
        expect(calc.press('±')).toBe('-5');
        expect(calc.press('±')).toBe('5');
        expect(calc.press('%')).toBe('0.05');
    });

    it('除以 0 显示错误，之后按数字可重新开始', () => {
        const calc = createCalculator();
        '1 ÷ 0 ='
            .split(' ')
            .forEach((k) => calc.press(k));
        expect(calc.display).toBe('错误');
        expect(calc.press('9')).toBe('9');
    });
});

// 工具：把 '12 + 3 =' 这样的按键串喂给计算器，返回最后的显示值。
// 连续数字（如 12、0.1）是一个整串，引擎里逐字拆开。运算符和功能键按空格分隔。
function press(keys) {
    const calc = createCalculator();
    let out = '0';
    keys.split(' ').forEach((chunk) => {
        if (/^[0-9.]+$/.test(chunk)) {
            // 数字串：逐字输入
            chunk.split('').forEach((k) => {
                out = calc.press(k);
            });
        } else {
            out = calc.press(chunk);
        }
    });
    return out;
}
