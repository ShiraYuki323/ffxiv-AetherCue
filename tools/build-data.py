"""Build a local combat action catalog; source revisions and schema checks are recorded."""
import argparse
import concurrent.futures
import csv
import datetime
import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
JOBS = {19:'PLD',20:'MNK',21:'WAR',22:'DRG',23:'BRD',24:'WHM',25:'BLM',27:'SMN',28:'SCH',30:'NIN',31:'MCH',32:'DRK',33:'AST',34:'SAM',35:'RDM',36:'BLU',37:'GNB',38:'DNC',39:'RPR',40:'SGE',41:'VPR',42:'PCT'}

def download(url, path):
    if not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent':'FFXIV-Axis-Replica/1.0'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=50) as response:
                    path.write_bytes(response.read())
                break
            except Exception:
                if attempt == 3: raise
    return path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default=str(ROOT/'tools'/'cache'))
    args = parser.parse_args()
    cache = pathlib.Path(args.cache); cache.mkdir(parents=True, exist_ok=True)
    def sheet(name):
        p = download(f'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/{name}.csv',cache/(name+'.csv'))
        with p.open(encoding='utf-8-sig',newline='') as f: return list(csv.reader(f))
    rows = sheet('Action'); cats = sheet('ClassJobCategory'); jobs = sheet('ClassJob')
    # This exporter contains an unnamed extra flag before Range. Explicit schema
    # validation prevents the off-by-one recast issue described in the source docs.
    assert rows[1][3]=='Icon' and rows[1][11]=='ClassJob' and rows[1][40]=='Recast<100ms>', 'CSV schema changed'
    byid = {int(r[0]):r for r in rows[3:] if r[0].isdigit()}
    assert byid[31][1]=='重劈' and byid[31][41]=='25' and byid[7389][41]=='600', 'CSV alignment changed'
    categories = {int(r[0]):[code for code in JOBS.values() if r[cats[1].index(code)]=='True'] for r in cats[3:]}
    tree_path=download('https://api.github.com/repos/xivintheshell/xivintheshell/git/trees/main?recursive=1',cache/'shell-tree.json')
    tree=json.loads(tree_path.read_text(encoding='utf-8'))
    paths=[x['path'] for x in tree['tree'] if x['path'].endswith('.ts') and (x['path'].startswith('src/Game/Data/Jobs/') or x['path'].startswith('src/Game/Data/Shared/'))]
    shell = {}
    def fetch(path):
        p=download('https://raw.githubusercontent.com/xivintheshell/xivintheshell/'+tree['sha']+'/'+path,cache/('shell-'+path.split('/')[-1]))
        return p.read_text(encoding='utf-8')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for content in ex.map(fetch,paths):
            for m in re.finditer(r'\b([A-Z][A-Z0-9_]+)\s*:\s*\{\s*id:\s*(\d+),\s*name:\s*(["`])([^"`]+)\3',content):
                shell[int(m[2])]={'en':m[4],'key':m[1]}
    actions = {}
    for id, r in byid.items():
        if not r[1] or not r[3].isdigit() or int(r[3])<=0 or r[4] not in ['2','3','4'] or r[57]=='True': continue
        allowed=categories.get(int(r[51]),[])
        if not allowed: continue
        # Ignore NPC-only variants, but retain player replacement/follow-up actions.
        if int(r[11])<0 and r[14]!='True' and id not in shell: continue
        gcd = int(r[42])==58 or int(r[43])==58
        a={'id':id,'name':r[1],'icon':int(r[3]),'gcd':gcd,'recast':int(r[41])/10,'level':int(r[13]),'jobs':allowed,'job':allowed[0] if len(allowed)==1 else 'ALL'}
        a.update(shell.get(id,{})); actions[id]=a
    assert actions[31]['gcd'] and not actions[7389]['gcd'] and actions[9]['gcd']
    data=ROOT/'overlay'/'data'; data.mkdir(parents=True,exist_ok=True)
    meta={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'https://github.com/thewakingsands/ffxiv-datamining-cn','actionCsvSHA256':hashlib.sha256((cache/'Action.csv').read_bytes()).hexdigest(),'shellRevision':tree['sha'],'count':len(actions),'englishMapped':sum('en' in a for a in actions.values()),'gcdRule':'CooldownGroup or AdditionalCooldownGroup == 58','note':'数据源快照；不声明与当前国服客户端版本完全一致。'}
    (data/'actions.js').write_text('window.ACTIONS = '+json.dumps(actions,ensure_ascii=False,separators=(',',':'))+';\nwindow.DATA_META = '+json.dumps(meta,ensure_ascii=False)+';\n',encoding='utf-8')
    jobdata=[{'id':int(r[0]),'code':JOBS[int(r[0])],'name':r[1]} for r in jobs[3:] if r[0].isdigit() and int(r[0]) in JOBS]
    (data/'jobs.js').write_text('window.JOBS = '+json.dumps(jobdata,ensure_ascii=False)+';\n',encoding='utf-8')
    (data/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    (data/'icons.txt').write_text('\n'.join(map(str,sorted({a['icon'] for a in actions.values()}))),encoding='utf-8')
    print(json.dumps(meta,ensure_ascii=False))

if __name__=='__main__': main()
