#!/usr/bin/env python3
"""Finds the channel's latest live-stream recording and latest video and writes them to the site.

What it does:
  1. Reads two of YouTube's public RSS feeds (no API key needed): the channel's automatic "live streams" playlist
     (UULV...) and its "videos" playlist (UULF..., long videos only: no Shorts, no live streams).
  2. Takes the newest finished live stream and the newest video, newest first.
  3. Writes them to _src/videos.json and downloads their thumbnails as assets/videos/<id>.jpg.

A live stream that is still running or has not started yet is skipped (shown once it has ended). Its state is read with the
YouTube Data API if the YT_API_KEY environment variable is set, otherwise from the video page (best effort: if the page cannot be
read, the stream is treated as finished).

If anything goes wrong (no network, YouTube does not answer) the script exits without an error; the last
successful record stays on the site. Uses only the standard library.
"""
import json, os, sys, urllib.request, xml.etree.ElementTree as ET

CHANNEL_ID = os.environ.get("YT_CHANNEL_ID", "UCwsdTtR9Lwl1TpoY2vPgjNw")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "_src", "videos.json")
THUMBS = os.path.join(ROOT, "assets", "videos")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "tr"}
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def get(url, binary=False, headers=None, timeout=25):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def read_feed(prefix):
    """prefix: 'UULV' (live streams) or 'UULF' (videos); the playlist id is the prefix + the channel id without 'UC'."""
    xml = get("https://www.youtube.com/feeds/videos.xml?playlist_id=" + prefix + CHANNEL_ID[2:])
    out = [{"id": e.find("yt:videoId", NS).text, "title": e.find("a:title", NS).text or "",
            "published": e.find("a:published", NS).text[:10], "stamp": e.find("a:published", NS).text}
           for e in ET.fromstring(xml).findall("a:entry", NS)]
    out.sort(key=lambda v: v["stamp"], reverse=True)
    return out


def is_running(vid):
    """True if the live stream is running or has not started yet; False if finished or if the state cannot be read."""
    try:
        key = os.environ.get("YT_API_KEY")
        if key:
            d = json.loads(get("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=%s&key=%s" % (vid, key)))
            return d["items"][0]["snippet"].get("liveBroadcastContent", "none") in ("live", "upcoming")
        html = get("https://www.youtube.com/watch?v=%s&hl=tr" % vid, headers={"Cookie": "CONSENT=YES+1; SOCS=CAI"})
        return '"isLiveNow":true' in html or '"isUpcoming":true' in html
    except Exception as ex:
        print("warning: could not read the state of %s (%s)" % (vid, ex))
        return False


def record(v, kind):
    return {"id": v["id"], "title": v["title"], "published": v["published"], "kind": kind,
            "url": "https://www.youtube.com/watch?v=" + v["id"], "stamp": v["stamp"]}


def main():
    try:
        live = next((v for v in read_feed("UULV")[:5] if not is_running(v["id"])), None)
        video = next(iter(read_feed("UULF")), None)
    except Exception as ex:
        print("warning: could not read the RSS feeds, keeping the current records (%s)" % ex)
        return 0
    chosen = sorted([record(v, k) for v, k in ((live, "Canlı yayın"), (video, "")) if v], key=lambda r: r["stamp"], reverse=True)
    for r in chosen:
        del r["stamp"]
    if not chosen:
        print("warning: no suitable record found, keeping the current records")
        return 0

    # thumbnails: assets/videos/<id>.jpg, downloaded if missing; thumbnails of videos that are no longer shown are removed
    os.makedirs(THUMBS, exist_ok=True)
    for v in chosen:
        path = os.path.join(THUMBS, v["id"] + ".jpg")
        if os.path.exists(path):
            continue
        for name in ("maxresdefault", "sddefault", "hqdefault"):
            try:
                img = get("https://i.ytimg.com/vi/%s/%s.jpg" % (v["id"], name), binary=True)
                if len(img) > 5000:
                    open(path, "wb").write(img)
                    break
            except Exception:
                continue
        else:
            print("warning: could not download the thumbnail of %s, records not changed" % v["id"])
            return 0
    keep = {v["id"] + ".jpg" for v in chosen}
    for f in os.listdir(THUMBS):
        if f.endswith(".jpg") and f not in keep:
            os.remove(os.path.join(THUMBS, f))

    old = json.load(open(DATA, encoding="utf-8")) if os.path.exists(DATA) else []
    if old != chosen:
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(chosen, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("updated:", ", ".join(v["published"] + " " + v["title"] for v in chosen))
    else:
        print("no change")
    return 0


if __name__ == "__main__":
    sys.exit(main())
