from __future__ import annotations
import concurrent.futures as cf
import hashlib, json, math, os, re, threading, time
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "_tmp" / "p025" / "primary_population_preoutcome_v3.csv"
OUTDIR = ROOT / "p025_v4_output"
OUTDIR.mkdir(exist_ok=True)

USER_AGENT = "MIA-P025 research; Independent Researcher, Australia; contact https://shaoyi-miao.github.io/"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "en-US,en;q=0.9",
}
MAX_WORKERS = 5
MIN_INTERVAL = 0.13  # global maximum < 8 requests/sec
TIMEOUT = 35
RETRIES = 5

_rate_lock = threading.Lock()
_next_allowed = 0.0
_tls = threading.local()

def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1<<20), b""):
            h.update(b)
    return h.hexdigest()

def session():
    if not hasattr(_tls, "s"):
        s=requests.Session()
        s.headers.update(HEADERS)
        _tls.s=s
    return _tls.s

def throttle():
    global _next_allowed
    with _rate_lock:
        now=time.monotonic()
        wait=max(0.0,_next_allowed-now)
        if wait:
            time.sleep(wait)
        _next_allowed=max(time.monotonic(),_next_allowed)+MIN_INTERVAL

def get(url: str):
    last=""
    for attempt in range(1, RETRIES+1):
        throttle()
        try:
            r=session().get(url, timeout=TIMEOUT, allow_redirects=True)
            if r.status_code==200:
                return r, ""
            last=f"HTTP_{r.status_code}"
            if r.status_code==404:
                return None,last
            if r.status_code in (403,429):
                time.sleep(min(30, 3*attempt))
            elif r.status_code>=500:
                time.sleep(min(20,2*attempt))
            else:
                return None,last
        except Exception as e:
            last=f"{type(e).__name__}:{e}"
            time.sleep(min(20,2*attempt))
    return None,last

def primary_doc_url(cik: str, adsh: str):
    cikn=str(int(float(cik)))
    acc=adsh.replace("-","")
    base=f"https://www.sec.gov/Archives/edgar/data/{cikn}/{acc}/"
    candidates=[f"{base}{adsh}-index.html", f"{base}{adsh}-index.htm"]
    errors=[]
    for index_url in candidates:
        r,err=get(index_url)
        if r is None:
            errors.append(f"{index_url}:{err}")
            continue
        soup=BeautifulSoup(r.text,"lxml")
        # Prefer an index table row whose Type cell is exactly 10-K.
        for tr in soup.find_all("tr"):
            cells=[td.get_text(" ",strip=True) for td in tr.find_all(["td","th"])]
            if not any(c.strip()=="10-K" for c in cells):
                continue
            a=tr.find("a",href=True)
            if a and re.search(r"\.html?$|\.htm$",a["href"],re.I):
                return urljoin(index_url,a["href"]), index_url, ""
        # Fallback: a document link in a row containing 10-K.
        for a in soup.find_all("a",href=True):
            href=a["href"]
            if not re.search(r"\.html?$|\.htm$",href,re.I):
                continue
            row=a.find_parent("tr")
            txt=row.get_text(" ",strip=True) if row else ""
            if re.search(r"(^|\s)10-K(\s|$)",txt,re.I):
                return urljoin(index_url,href), index_url, ""
        errors.append(f"{index_url}:NO_10K_LINK")
    return None, None, ";".join(errors)

HYPHENS = str.maketrans({
    "\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-","\u2212":"-",
    "\u00a0":" "
})
AMOUNT_RE=re.compile(r"\$\s*\(?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*\)?\s*(billion|million|thousand)?",re.I)

def normalize_text(s: str)->str:
    return re.sub(r"\s+"," ",s.translate(HYPHENS)).strip()

def amount_value(num: str, unit: str|None):
    v=float(num.replace(",",""))
    u=(unit or "").lower()
    if u=="billion": v*=1e9
    elif u=="million": v*=1e6
    elif u=="thousand": v*=1e3
    return v

def parse_public_float(html: str):
    soup=BeautifulSoup(html,"lxml")
    for tag in soup(["script","style","noscript"]):
        tag.decompose()
    text=normalize_text(soup.get_text(" ",strip=True))
    low=text.lower()
    starts=[m.start() for m in re.finditer(r"aggregate market value",low)]
    if not starts:
        return {"source_status":"UNRESOLVED_NO_AGGREGATE_MARKET_VALUE","cover_text":text[:2200]}
    candidates=[]
    for st in starts:
        window=text[st:st+2400]
        wl=window.lower()
        if not re.search(r"held by non-?affiliates",wl):
            continue
        # Stop before the next standard cover-page section when possible.
        cut=len(window)
        for marker in ["number of shares", "shares of common stock outstanding",
                       "documents incorporated by reference", "indicate by check mark whether"]:
            q=wl.find(marker,80)
            if q!=-1: cut=min(cut,q)
        sentence=window[:cut]
        amounts=[]
        for m in AMOUNT_RE.finditer(sentence):
            val=amount_value(m.group(1),m.group(2))
            amounts.append((val,m.group(0)))
        # De-duplicate identical numeric amounts repeated by HTML layout.
        uniq=[]
        for val,tok in amounts:
            if not any(abs(val-u[0])<=0.5 for u in uniq):
                uniq.append((val,tok))
        if len(uniq)==1:
            candidates.append(("RESOLVED_SINGLE_AMOUNT",uniq[0][0],uniq[0][1],sentence))
        elif len(uniq)>1:
            candidates.append(("UNRESOLVED_MULTIPLE_AMOUNTS",None,
                               " | ".join(x[1] for x in uniq),sentence))
        elif re.search(r"\bnone\b|\bnot applicable\b|\bn/?a\b",sentence,re.I):
            candidates.append(("RESOLVED_NONE_ZERO",0.0,"NONE/N-A",sentence))
        else:
            candidates.append(("UNRESOLVED_NO_AMOUNT",None,"",sentence))
    if not candidates:
        return {"source_status":"UNRESOLVED_NO_NONAFFILIATE_WINDOW","cover_text":text[:2600]}
    resolved=[x for x in candidates if x[0].startswith("RESOLVED_")]
    if len(resolved)==1:
        st,val,tok,snip=resolved[0]
        return {"source_status":st,"visible_public_float":val,"amount_token":tok,
                "cover_text":snip[:2400]}
    if len(resolved)>1:
        vals={round(float(x[1]),2) for x in resolved if x[1] is not None}
        if len(vals)==1:
            st,val,tok,snip=resolved[0]
            return {"source_status":"RESOLVED_DUPLICATE_SAME_VALUE","visible_public_float":val,
                    "amount_token":tok,"cover_text":snip[:2400]}
        return {"source_status":"UNRESOLVED_MULTIPLE_WINDOWS",
                "cover_text":" || ".join(x[3][:900] for x in resolved[:3])}
    st,val,tok,snip=candidates[0]
    return {"source_status":st,"amount_token":tok,"cover_text":snip[:2400]}

def one(row):
    cik=str(row.cik); adsh=str(row.adsh)
    base={"cik":cik,"adsh":adsh,"filed":row.filed,"name":row.name,
          "v3_public_float":row.public_float,
          "public_float_context_end":row.public_float_context_end}
    doc,index,err=primary_doc_url(cik,adsh)
    if not doc:
        return {**base,"source_status":"UNRESOLVED_PRIMARY_DOCUMENT","fetch_error":err}
    r,derr=get(doc)
    if r is None:
        return {**base,"primary_document_url":doc,"filing_index_url":index,
                "source_status":"UNRESOLVED_PRIMARY_FETCH","fetch_error":derr}
    parsed=parse_public_float(r.text)
    out={**base,"primary_document_url":doc,"filing_index_url":index,
         "fetch_error":"","document_sha256":hashlib.sha256(r.content).hexdigest(),**parsed}
    new=out.get("visible_public_float")
    try: old=float(row.public_float)
    except: old=math.nan
    if new is not None and math.isfinite(old):
        out["delta_visible_minus_v3"]=float(new)-old
        if old==0:
            out["ratio_v3_to_visible"]=None if new==0 else math.inf
        else:
            out["ratio_v3_to_visible"]=old/float(new) if new!=0 else math.inf
        out["source_changed"]=abs(float(new)-old)>0.5
    else:
        out["source_changed"]=None
    return out

def main():
    d=pd.read_csv(INPUT,dtype=str,low_memory=False)
    assert len(d)==2729, f"unexpected input rows {len(d)}"
    rows=list(d.itertuples(index=False))
    results=[]
    with cf.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs={ex.submit(one,r):r.adsh for r in rows}
        for n,f in enumerate(cf.as_completed(futs),1):
            try:
                results.append(f.result())
            except Exception as e:
                results.append({"adsh":futs[f],"source_status":"UNRESOLVED_WORKER_EXCEPTION",
                                "fetch_error":f"{type(e).__name__}:{e}"})
            if n%100==0:
                print(f"processed {n}/{len(rows)}",flush=True)
                pd.DataFrame(results).to_csv(OUTDIR/"source_replay_partial.csv",index=False)
    out=pd.DataFrame(results)
    out=out.sort_values(["cik","adsh"],na_position="last")
    out.to_csv(OUTDIR/"source_replay.csv",index=False)
    changed=out[out["source_changed"].eq(True)] if "source_changed" in out else out.iloc[0:0]
    unresolved=out[~out["source_status"].astype(str).str.startswith("RESOLVED_")]
    changed.to_csv(OUTDIR/"source_changed.csv",index=False)
    unresolved.to_csv(OUTDIR/"source_unresolved.csv",index=False)
    summary={
        "input_rows":len(d),
        "result_rows":len(out),
        "status_counts":out["source_status"].value_counts(dropna=False).to_dict(),
        "resolved_rows":int(out["source_status"].astype(str).str.startswith("RESOLVED_").sum()),
        "changed_rows":int(len(changed)),
        "unresolved_rows":int(len(unresolved)),
        "input_sha256":sha256_file(INPUT),
        "output_sha256":sha256_file(OUTDIR/"source_replay.csv"),
        "changed_sha256":sha256_file(OUTDIR/"source_changed.csv"),
        "unresolved_sha256":sha256_file(OUTDIR/"source_unresolved.csv"),
        "user_agent":USER_AGENT,
        "global_min_request_interval_seconds":MIN_INTERVAL,
        "max_workers":MAX_WORKERS,
    }
    (OUTDIR/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print(json.dumps(summary,indent=2),flush=True)

if __name__=="__main__":
    main()
