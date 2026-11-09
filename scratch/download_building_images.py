import os
import re
import urllib.request
import urllib.error

def main():
    # Directories
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(base_dir, "admin", "public", "images", "buildings")
    os.makedirs(target_dir, exist_ok=True)
    
    # Path to client_scripts.txt
    client_scripts_path = os.path.join(base_dir, "client_scripts.txt")
    
    # Set of found building names
    building_names = set()
    
    # Predefined known list of standard buildings to ensure we get them
    known_buildings = [
        "mayorhouse", "storehouse", "improvedstorehouse", "spaciousstorehouse", "floatingstorehouse",
        "woodcutter", "forester", "sawmill", "cokingplant", "coalmine", "ironmine", "goldmine", "coppermine",
        "ironore", "goldore", "bronzeore", "stonecutter", "marblecutter", "granitecutter",
        "farm", "silo", "improvedsilo", "waterstorehouse", "well", "improvedwell", "mill", "bakery",
        "brewery", "stable", "butcher", "hunter", "deerstalkerhut", "fisher", "fishfarm",
        "bronzeweaponsmith", "ironweaponsmith", "steelweaponsmith", "titaniumweaponsmith", "damasceneswordweaponsmith",
        "platinumweaponsmith", "bowmaker", "longbowmaker", "crossbowmaker", "gunpowderforge", "cannonforge",
        "bronzesmelter", "ironsmelter", "steelsmelter", "goldsmelter", "titaniumsmelter", "platinumsmelter",
        "toolmaker", "advancedtoolmaker", "residence", "nobleresidence", "floatingresidence", "magnificentresidence",
        "tavern", "guildhouse", "provisionhouse", "barracks", "elitebarracks", "academy", "harbour", "watchtower",
        "darkcastle", "witchtower", "bonechurch", "palace", "epicwoodworkyard", "epicfarmyard", "monastery",
        "watercastle", "recyclingmanufactory", "goldtower", "fairytaleacademy", "crystallighthouse",
        "spookyshuck", "blackcastle", "piratehut", "pavilion", "statue", "flowerbed", "bench"
    ]
    for b in known_buildings:
        building_names.add(b)
        
    # Scan client_scripts.txt for dynamically defined building names
    if os.path.exists(client_scripts_path):
        print("Scanning client_scripts.txt for building names...")
        # Regex to find potential building names in ActionScript source code strings
        pattern = re.compile(r'"([A-Za-z0-9_]{3,40})"')
        keywords = ["house", "storehouse", "residence", "cutter", "mine", "smelter", "weaponsmith", 
                    "maker", "forge", "farm", "well", "silo", "brewery", "bakery", "mill", "butcher",
                    "stable", "tower", "castle", "temple", "monuments", "deco", "decoration"]
        
        try:
            with open(client_scripts_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    matches = pattern.findall(line)
                    for m in matches:
                        m_lower = m.lower()
                        # Clean level and suffix info
                        m_clean = re.sub(r'_lvl_\d+', '', m_lower)
                        m_clean = re.sub(r'_\d+', '', m_clean)
                        m_clean = m_clean.replace("decoration_", "").strip()
                        
                        if any(kw in m_clean for kw in keywords) and len(m_clean) > 3:
                            building_names.add(m_clean)
        except Exception as e:
            print(f"Error reading client_scripts.txt: {e}")
            
    print(f"Total potential building names identified: {len(building_names)}")
    
    # Download loop
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
    downloaded = 0
    skipped = 0
    
    # Try downloading from Settlers Online Wiki
    # The wiki often capitalizes filenames like "Bowmaker.png" or keeps them lowercase. We will try both.
    for bname in sorted(building_names):
        target_path = os.path.join(target_dir, f"{bname}.png")
        if os.path.exists(target_path):
            skipped += 1
            continue
            
        # Try different capitalization variations on the Wiki
        variations = [
            bname,  # lowercase
            bname.capitalize(),  # Bowmaker
            "".join(x.capitalize() for x in bname.split("_")),  # CamelCase
        ]
        
        success = False
        for var in variations:
            url = f"https://settlersonlinewiki.eu/images/buildings/{var}.png"
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=5) as response:
                    with open(target_path, 'wb') as out_file:
                        out_file.write(response.read())
                print(f"Successfully downloaded: {bname} ({url})")
                downloaded += 1
                success = True
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    continue
                else:
                    print(f"HTTP error downloading {bname} from {url}: {e.code}")
            except Exception as e:
                print(f"Error downloading {bname} from {url}: {e}")
                
        if not success:
            # Try to copy from local resource folder if it exists there
            local_res_path = os.path.join(base_dir, "admin", "public", "images", "resources", f"{bname}.png")
            if os.path.exists(local_res_path):
                try:
                    import shutil
                    shutil.copy(local_res_path, target_path)
                    print(f"Copied from local resources: {bname}")
                    downloaded += 1
                    success = True
                except Exception as e:
                    print(f"Failed to copy local resource for {bname}: {e}")

    print(f"\nDone! Downloaded/Copied: {downloaded}, Already exists/Skipped: {skipped}")

if __name__ == "__main__":
    main()
