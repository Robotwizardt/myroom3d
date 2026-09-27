// iphone4sBody 数据测试：尺寸合理、细节在机身范围内、比例像真机（竖版布局）
import { describe, expect, it } from 'vitest';

import { BACK, BODY, FRONT, HOME_HIT, mm, SCREEN, SIDE, sideButtonRadius } from '../data/iphone4sBody';

describe('iphone4sBody 布局常量（竖版）', () => {
    it('机身长固定 0.612（对准桌上烘焙道具），宽/厚按真机 115.2×58.6×9.3 等比', () => {
        expect(BODY.length).toBeCloseTo(0.612, 3);
        // 真机比例：宽/长 = 58.6/115.2、厚/长 = 9.3/115.2（独立于实现的比例事实）
        expect(BODY.width / BODY.length).toBeCloseTo(58.6 / 115.2, 3);
        expect(BODY.depth / BODY.length).toBeCloseTo(9.3 / 115.2, 3);
        // 圆角是 4s 的大圆角，但别圆成胶囊
        expect(BODY.cornerRadius).toBeGreaterThan(0.03);
        expect(BODY.cornerRadius).toBeLessThan(BODY.width / 3);
    });

    it('长宽比接近真机 4s（115.2/58.6 ≈ 1.966）', () => {
        const ratio = BODY.length / BODY.width;
        expect(ratio).toBeGreaterThan(1.8);
        expect(ratio).toBeLessThan(2.1);
    });

    it('屏幕开口 = 真机有效显示区 74.8×49.87mm（3:2），上下边框各 20.2mm 居中', () => {
        // 真机 960×640 @326ppi → 显示区 74.8 × 49.87 mm，比例 1.4999 ≈ 3:2
        expect(SCREEN.ratio).toBeCloseTo(74.8 / 49.87, 2);
        expect(SCREEN.length / BODY.length).toBeCloseTo(74.8 / 115.2, 3);
        expect(SCREEN.width / BODY.width).toBeCloseTo(49.87 / 58.6, 3);
        // 参考图实测：显示区在机身上「上下居中」（上 20.40 / 下 20.32）
        expect(FRONT.screen.marginTop).toBeCloseTo(FRONT.screen.marginBottom, 5);
        expect(FRONT.screen.marginTop / BODY.length).toBeCloseTo(20.2 / 115.2, 3);
        // 左右边框各 4.365mm（Horizontal Full Bezel Width 8.73mm）
        expect(FRONT.screen.marginSide / BODY.length).toBeCloseTo(4.365 / 115.2, 4);
        expect(SCREEN.centerX).toBeCloseTo(0, 6);
    });

    it('正面细节都在机身内且落在屏幕开口之外的黑边里：听筒、前摄、传感器、Home 键', () => {
        // 听筒在顶部黑边内、水平居中
        expect(FRONT.earpiece.xFromTop).toBeLessThan(FRONT.screen.marginTop);
        expect(FRONT.earpiece.wide / BODY.width).toBeCloseTo(9.7 / 58.6, 3);
        // 前摄与听筒同高，位于中线左侧（8.5mm）
        expect(FRONT.camera.xFromTop).toBeLessThan(FRONT.screen.marginTop);
        expect(FRONT.camera.zFromCenter).toBeLessThan(0);
        expect(FRONT.camera.zFromCenter / BODY.length).toBeCloseTo(-8.5 / 115.2, 4);
        // 传感器窗在听筒之上
        expect(FRONT.sensor.xFromTop).toBeLessThan(FRONT.earpiece.xFromTop);
        // Home 键圆心离底边够远，圆不越界；直径 11.6mm
        expect(FRONT.homeBtn.xFromBottom).toBeGreaterThan(FRONT.homeBtn.r);
        expect((FRONT.homeBtn.r * 2) / BODY.length).toBeCloseTo(11.6 / 115.2, 3);
        // 开口本身在机身内
        expect(SCREEN.length).toBeGreaterThan(0.3);
        expect(SCREEN.width).toBeGreaterThan(0.15);
        expect(SCREEN.length).toBeLessThan(BODY.length);
        expect(SCREEN.width).toBeLessThan(BODY.width);
    });

    it('DOM 屏世界尺寸比开口每边多不到 0.5mm（bleed 压住缝，比例仍与开口一致）', () => {
        const domL = (SCREEN.domH * SCREEN.distanceFactor) / 400;
        const domW = (SCREEN.domW * SCREEN.distanceFactor) / 400;
        // 长边每边多 0.4mm（= bleed/2），宽边按 2:3 等比
        expect((domL - SCREEN.length) / 2).toBeCloseTo(SCREEN.bleed / 2, 4);
        expect((domL - SCREEN.length) / 2).toBeLessThan(mm(0.5));
        expect(domW - SCREEN.width).toBeCloseTo((SCREEN.bleed * 2) / 3, 4);
        expect((domW - SCREEN.width) / 2).toBeLessThan(mm(0.4));
        // DOM 是 320×480 = 2:3，和开口 1.4999 基本一致（变形 < 0.1%）
        expect(SCREEN.ratio / (SCREEN.domH / SCREEN.domW)).toBeCloseTo(1, 3);
    });

    it('侧面按键位置对称合理（竖版：音量+ 在音量- 上方）', () => {
        expect(SIDE.muteSwitch.side).toBe('left');
        expect(SIDE.volumeUp.side).toBe('left');
        expect(SIDE.volumeDown.side).toBe('left');
        expect(SIDE.powerBtn.side).toBe('top');
        // 音量+ 的 xCenter 更靠顶部（x 更大）
        expect(SIDE.volumeUp.xCenter).toBeGreaterThan(SIDE.volumeDown.xCenter);
        // 静音拨片在最上，电源键在顶边中线靠左（+14.96mm）
        expect(SIDE.muteSwitch.xCenter).toBeGreaterThan(SIDE.volumeUp.xCenter);
        expect(SIDE.powerBtn.zCenter).toBeCloseTo((44.26 - 29.3) / 115.2 * BODY.length, 4);
        // 按键都在机身长轴范围内
        expect(Math.abs(SIDE.muteSwitch.xCenter)).toBeLessThan(BODY.length / 2);
        expect(Math.abs(SIDE.volumeUp.xCenter)).toBeLessThan(BODY.length / 2);
        expect(Math.abs(SIDE.volumeDown.xCenter)).toBeLessThan(BODY.length / 2);
        // 凸出量只有零点几毫米（不是穿出前后玻璃的粗黑块）
        expect(SIDE.muteSwitch.thick).toBeLessThan(BODY.depth / 2);
        expect(SIDE.bandHeight).toBeLessThan(BODY.depth);
        expect(SIDE.antennaGaps).toBe(true);
    });

    it('背面细节像 4s：摄像头偏一边，闪光灯在旁，logo 居中', () => {
        // 摄像头不在中线上（真机在左上角）
        expect(Math.abs(BACK.camera.zFromCenter)).toBeGreaterThan(0.05);
        expect(BACK.logo.size).toBeLessThan(BODY.width * 0.8);
        // 摄像头与闪光灯并排（xFromTop 相近）
        expect(BACK.flash.xFromTop).toBeCloseTo(BACK.camera.xFromTop, 2);
        expect(BACK.flash.zFromCenter).not.toBeCloseTo(BACK.camera.zFromCenter, 2);
    });

    it('机身 Home 键的 DOM 热区落在屏幕正下方、水平居中、按真机比例', () => {
        const pxPerMm = SCREEN.domH / (SCREEN.length / mm(1));
        expect(HOME_HIT.size).toBeCloseTo(11.6 * pxPerMm, 1);
        expect(HOME_HIT.left + HOME_HIT.size / 2).toBeCloseTo(SCREEN.domW / 2, 6);
        // 整块热区都在屏幕下方（真机下边框内），不压住显示区
        expect(HOME_HIT.top).toBeGreaterThan(SCREEN.domH);
        const phoneBottomPx = SCREEN.domH + (FRONT.screen.marginBottom / mm(1)) * pxPerMm;
        expect(HOME_HIT.top + HOME_HIT.size).toBeLessThan(phoneBottomPx);
    });

    it('侧键倒角半径按最小边算（radius 超过边长一半会让 RoundedBox 鼓出）', () => {
        // 回归护拦：曾经 radius = min(bandHeight, thick)*0.45 = 10.5mm，
        // 而电源键厚度只有 2.9mm → 网格沿厚度方向胀到 47.8mm（那块「黑舌头」）。
        const keys = [SIDE.muteSwitch, SIDE.volumeUp, SIDE.volumeDown, SIDE.powerBtn];
        keys.forEach((k) => {
            const size = [k.len, SIDE.bandHeight, k.thick];
            const radius = sideButtonRadius(size);
            expect(radius).toBeLessThanOrEqual(Math.min(...size) / 2);
            expect(radius).toBeCloseTo(k.thick * 0.45, 6);
        });
    });
});
