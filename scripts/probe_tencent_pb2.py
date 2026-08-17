# probe_tencent_pb2.py
import urllib.request

for code in ["00700", "00005", "01109", "01299", "02318", "03988", "06886"]:
    url = f"http://qt.gtimg.cn/q=hk{code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read().decode("gbk", "ignore")
    inner = body.split('="', 1)[1]
    if inner.endswith('";'):
        inner = inner[:-2]
    elif inner.endswith('"'):
        inner = inner[:-1]
    fields = inner.split("~")
    idxs = [3, 39, 43, 44, 45, 46, 47, 48, 49, 50, 51, 57, 58, 64, 65, 71, 72]
    bits = {i: (fields[i] if i < len(fields) else "") for i in idxs}
    print(code, bits)
