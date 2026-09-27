const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'utf8');
const d = JSON.parse(s.slice(s.indexOf('{')));
console.log('tableYs', JSON.stringify(d.tableYs));
console.log('phonePos', JSON.stringify(d.phonePos), 'frameLocalSize', JSON.stringify(d.frameLocalSize));
console.log('--- nearMeshes ---');
for (const m of d.nearMeshes) {
    console.log(`${m.mat} ${m.color} worldC=${JSON.stringify(m.worldCenter)} localC=${JSON.stringify(m.localCenter)} size=${JSON.stringify(m.size)} y=[${m.yMin},${m.yMax}] d=${m.distXZ}`);
}
console.log('--- clusters (by tris) ---');
for (const c of d.clusters) {
    console.log(`${c.tris}tris ${c.cells}cells world=${JSON.stringify(c.worldMN)}..${JSON.stringify(c.worldMX)} size=${JSON.stringify(c.size)} local=${JSON.stringify(c.localMN)}..${JSON.stringify(c.localMX)} lsize=${JSON.stringify(c.localSize)} d=${c.distXZ}`);
}
console.log('totalTris', d.totalTris);
