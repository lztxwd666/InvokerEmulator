"""Download Invoker-related public assets for local development.

Sources:
- Hero/ability images: Steam CDN (official Dota 2 web assets)
- Sound files: Dota 2 Wiki via Fandom MediaWiki API
- Note: additional UI sounds and cursor images are kept in the repository manually.

IMPORTANT: These assets are Valve/Dota 2 copyrighted materials.
Use them only for local learning/prototyping; do not redistribute blindly.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "assets" / "images"
AUDIO_DIR = ROOT / "assets" / "audio" / "invoker"
UA = {"User-Agent": "Mozilla/5.0"}

ABILITY_NAMES = [
    "invoker_quas", "invoker_wex", "invoker_exort", "invoker_invoke",
    "invoker_cold_snap", "invoker_ghost_walk", "invoker_tornado",
    "invoker_emp", "invoker_alacrity", "invoker_chaos_meteor",
    "invoker_sun_strike", "invoker_forge_spirit", "invoker_ice_wall",
    "invoker_deafening_blast",
]

ITEM_IMAGES = {
    "refresher": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/items/refresher.png",
    "sheepstick": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/items/sheepstick.png",
    "meteor_hammer": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/items/meteor_hammer.png",
    "travel_boots": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/items/travel_boots.png",
}

HERO_IMAGES = {
    "invoker.png": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes/invoker.png",
    "invoker_icon.png": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/invoker.png",
    "invoker_wide.png": "https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes/wide/invoker.png",
}

# 部分 Fandom 音效文件名与项目内实际使用名不一致，这里统一映射。
SOUND_FILE_MAP = {
    "Refresher Orb.mp3": "refresher.mp3",
    "Scythe of Vyse.mp3": "sheepstick.mp3",
    "Meteor Hammer.mp3": "meteor_hammer.mp3",
    "Teleport.mp3": "travel_boots.mp3",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def download_images() -> None:
    (IMAGES_DIR / "heroes").mkdir(parents=True, exist_ok=True)
    (IMAGES_DIR / "abilities").mkdir(parents=True, exist_ok=True)
    for name, url in HERO_IMAGES.items():
        path = IMAGES_DIR / "heroes" / name
        if not path.exists():
            path.write_bytes(fetch(url))
            print("hero", name)
    for ability in ABILITY_NAMES:
        path = IMAGES_DIR / "abilities" / f"{ability}.png"
        if not path.exists():
            url = f"https://cdn.steamstatic.com/apps/dota2/images/dota_react/abilities/{ability}.png"
            path.write_bytes(fetch(url))
            print("ability", ability)
    (IMAGES_DIR / "items").mkdir(parents=True, exist_ok=True)
    for name, url in ITEM_IMAGES.items():
        path = IMAGES_DIR / "items" / f"{name}.png"
        if not path.exists():
            path.write_bytes(fetch(url))
            print("item", name)


def _sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


def download_sounds() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    # Curated list of the most useful Invoker-related sounds from Dota 2 Wiki.
    sounds = [
        "Invoke.mp3",
        "Cold Snap.mp3", "Cold Snap target.mp3", "Time Walk.mp3", "Lich projectile launch.mp3",
        "Ghost Walk.mp3",
        "Ice Wall.mp3", "Cold Feet cast.mp3",
        "E.M.P..mp3", "E.M.P. cast.mp3", "E.M.P. target.mp3", "E.M.P. effect.mp3",
        "Tornado.mp3", "Tornado cast.mp3", "Tornado travel.mp3",
        "Alacrity.mp3",
        "Sun Strike.mp3", "Sun Strike cast.mp3", "Sun Strike effect.mp3",
        "Forge Spirit.mp3", "Shadow Word cast damage.mp3",
        "Chaos Meteor.mp3", "Chaos Meteor cast.mp3", "Chaos Meteor loop.mp3",
        "Chaos Meteor target.mp3", "Lina projectile impact.mp3", "Chaos Meteor alt.mp3",
        "Deafening Blast.mp3",
        "Dark Artistry Cape Tornado.mp3", "Dark Artistry Cape Tornado cast.mp3",
        "Dark Artistry Cape Deafening Blast.mp3",
        "Magus Apex Sun Strike.mp3", "Magus Apex Sun Strike cast.mp3", "Magus Apex Sun Strike effect.mp3",
        "Witch Doctor preattack.mp3", "Witch Doctor projectile launch.mp3", "Witch Doctor projectile impact.mp3",
        "Radiant ranged projectile launch1.mp3", "Radiant ranged projectile launch2.mp3",
        "Radiant ranged projectile launch3.mp3", "Radiant ranged projectile launch4.mp3",
        "Radiant ranged projectile impact1.mp3", "Radiant ranged projectile impact2.mp3",
        "Radiant ranged projectile impact3.mp3", "Radiant ranged projectile impact4.mp3",
        "Shared footstep hero general1.mp3", "Shared footstep hero general2.mp3",
        "Shared footstep hero general3.mp3", "Shared footstep hero general4.mp3",
        "Shared footstep hero general5.mp3", "Shared footstep hero general6.mp3",
        "Shared footstep hero general7.mp3", "Spectre idle loop.mp3",
        "Refresher Orb.mp3", "Scythe of Vyse.mp3", "Meteor Hammer.mp3", "Teleport.mp3",
    ]
    manifest = {}
    for sound in sounds:
        title = "File:" + sound
        api_url = (
            "https://dota2.fandom.com/api.php?action=query&titles="
            + urllib.parse.quote(title)
            + "&prop=imageinfo&iiprop=url|size&format=json&formatversion=2"
        )
        try:
            data = json.loads(fetch(api_url).decode("utf-8"))
            pages = data.get("query", {}).get("pages", [])
            if not pages or not pages[0].get("imageinfo"):
                print("missing", sound)
                continue
            url = pages[0]["imageinfo"][0]["url"]
            filename = SOUND_FILE_MAP.get(sound, _sanitize(sound))
            path = AUDIO_DIR / filename
            if not path.exists():
                path.write_bytes(fetch(url))
                print("sound", filename)
            manifest[sound] = {"file": filename, "url": url}
        except Exception as exc:  # pragma: no cover - network dependent
            print("error", sound, exc)
        time.sleep(0.05)
    (AUDIO_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    download_images()
    download_sounds()


if __name__ == "__main__":
    main()
