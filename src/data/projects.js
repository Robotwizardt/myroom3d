/**
 * ============================================================
 *  你的项目数据 —— 【以后只改这一个文件就够了】
 * ============================================================
 * 房间里的 6 张卡片会按顺序读这里的 6 条数据。
 * 改完保存，页面会热更新，不用重启。
 *
 * 每一项字段说明：
 *   id       唯一标识，别重复
 *   title    项目标题（显示成大标题）
 *   subtitle 一句话简介
 *   tags     技术标签数组
 *   desc     详细描述，支持多行（数组里每个元素是一段）
 *   links    链接数组 { label, url }，url 填你自己的网址；暂时没有就留空数组
 *   accent   主题色（CSS 颜色），用来给每张卡一个不同的配色
 *
 * ⚠️ 注意：这个版本是【纯本地】的，不请求任何外网。
 *     links 里的 url 点了会在新标签页打开，如果你填的是外网地址，
 *     需要你自己网络能访问才行。
 */

export const PROJECTS = [
    {
        id: 'p1',
        title: '我的项目 01',
        subtitle: '一句话说明这个项目是做什么的',
        tags: ['React', 'Three.js'],
        desc: [
            '这里是第一段详细描述。',
            '这里可以再写一段，讲讲你做了什么、遇到什么难点、怎么解决的。'
        ],
        links: [],
        accent: '#ff6b6b'
    },
    {
        id: 'p2',
        title: '我的项目 02',
        subtitle: '换一行简介试试',
        tags: ['Vue', 'Vite'],
        desc: ['第二段占位描述，照着 projects.js 里的注释改就行。'],
        links: [],
        accent: '#4ecdc4'
    },
    {
        id: 'p3',
        title: '我的项目 03',
        subtitle: '第三个项目',
        tags: ['Node.js', 'Express'],
        desc: ['后端也可以放进来，这个面板只是 HTML，写什么都能显示。'],
        links: [],
        accent: '#a06bff'
    },
    {
        id: 'p4',
        title: '我的项目 04',
        subtitle: '第四个项目',
        tags: ['Python', 'FastAPI'],
        desc: ['想放图片？在 public/ 下丢图片，然后改 projects.js 加 image 字段。'],
        links: [],
        accent: '#ffa94d'
    },
    {
        id: 'p5',
        title: '我的项目 05',
        subtitle: '第五个项目',
        tags: ['TypeScript'],
        desc: ['每个 tag 会渲染成一个小胶囊，删掉就少一个。'],
        links: [],
        accent: '#74c0fc'
    },
    {
        id: 'p6',
        title: '我的项目 06',
        subtitle: '第六个项目',
        tags: ['Docker', 'CI/CD'],
        desc: ['最后一张卡，改完这 6 条，整个房间就是你的作品集了。'],
        links: [],
        accent: '#f783ac'
    }
];
