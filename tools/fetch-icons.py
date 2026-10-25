"""Cache XIVAPI icons for offline use. Existing valid PNGs are retained."""
import concurrent.futures
import pathlib
import urllib.request
import io
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'overlay'/'icons'
OUT.mkdir(exist_ok=True)
def fetch(id):
    target=OUT/(str(id)+'.png')
    if target.exists() and target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'): return None
    for suffix in ['_hr1','']:
        u=f'https://cafemaker.wakingsands.com/i/{id//1000*1000:06d}/{id:06d}{suffix}.png'
        for attempt in range(2):
            try:
                with urllib.request.urlopen(u,timeout=10) as r: data=r.read()
                # The CN endpoint can negotiate WebP even for a .png URL.
                image=Image.open(io.BytesIO(data));image.load()
                image.save(target,format='PNG');return None
            except Exception: pass
    return id
if __name__=='__main__':
    ids=[int(x) for x in (ROOT/'overlay'/'data'/'icons.txt').read_text().split()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        missing=[id for id in pool.map(fetch,ids) if id is not None]
    (ROOT/'overlay'/'data'/'missing-icons.txt').write_text('\n'.join(map(str,missing)))
    print(f'Icons: {len(ids)-len(missing)}/{len(ids)}; missing: {missing}')
