# probe_tencent_pb.py
import urllib.request

url = "http://qt.gtimg.cn/q=hk03988"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=10) as r:
    raw = r.read().decode("gbk", "ignore")
fields = raw.split('="')[1].rstrip('";\n').split("~")
print("len", len(fields))
for i, p in enumerate(fields):
    print(f"{i}: {p}")
