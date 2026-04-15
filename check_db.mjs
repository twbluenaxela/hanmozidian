import Database from 'better-sqlite3';
const db = new Database('./data/shufazidian.db', { readonly: true });
console.log('images:', db.prepare('SELECT COUNT(*) as c FROM calligraphy_images').get());
console.log('chars:', db.prepare('SELECT COUNT(*) as c FROM characters').get());
console.log('calligraphers:', db.prepare('SELECT COUNT(*) as c FROM calligraphers').get());
console.log('works:', db.prepare('SELECT COUNT(*) as c FROM works').get());
console.log('styles:', db.prepare('SELECT * FROM script_styles').all());
console.log('sources:', db.prepare('SELECT source, COUNT(*) as c FROM calligraphy_images GROUP BY source').all());
db.close();