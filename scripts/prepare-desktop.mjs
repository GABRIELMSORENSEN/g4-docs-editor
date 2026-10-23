import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const stage=path.resolve(root,'desktop-stage');
if(path.dirname(stage)!==root||path.basename(stage)!=='desktop-stage')throw new Error('Invalid staging directory');
try{if((await fs.lstat(stage)).isSymbolicLink())throw new Error('Staging must not be a symlink');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
for(const folder of ['dist','electron'])await fs.cp(path.join(root,folder),path.join(stage,folder),{recursive:true});
await fs.mkdir(path.join(stage,'build'),{recursive:true});await fs.copyFile(path.join(root,'build/icon.png'),path.join(stage,'build/icon.png'));
await fs.copyFile(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
const source=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const {name,version,description,author,license,main}=source;
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name,version,description,author,license,main},null,2));
