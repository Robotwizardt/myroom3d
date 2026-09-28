/**
 * 电视屏内那套 UI（卡带菜单 / 开机遮罩）的动效与配色（见 ADR-0003）。
 * 布局用内联样式写在组件里，需要 @keyframes 与 :hover 的部分放这里，
 * 避免组件文件里又塞样式表又塞逻辑。
 */
const CSS = `
@keyframes tvFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes tvCartGlow {
    0%, 100% { filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.45)); }
    50% { filter: drop-shadow(0 22px 34px rgba(123, 92, 255, 0.55)); }
}
@keyframes tvPulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
}
[data-testid="tv-cartridge"] {
    transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
}
[data-testid="tv-cartridge"]:hover {
    transform: translateY(-14px) scale(1.03);
}
[data-testid="tv-cartridge"][data-selected="true"] {
    animation: tvCartGlow 2.4s ease-in-out infinite;
    transform: translateY(-22px) scale(1.07);
}
[data-testid="tv-menu-exit"]:hover,
[data-testid="tv-game-exit"]:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    opacity: 1 !important;
}
`;

export const TvScreenStyles = () => <style>{CSS}</style>;

export default TvScreenStyles;
