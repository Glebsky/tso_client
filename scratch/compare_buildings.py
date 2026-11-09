import json
import os

def analyze():
    path = r"c:\OSPanel\domains\tso_client\admin\storage\app\debug_envelope.json"
    if not os.path.exists(path):
        print(f"File not found at: {path}")
        return

    print(f"Reading {path}...")
    with open(path, 'r', encoding='utf-16') as f:
        envelope = json.load(f)

    # Let's search recursively for dBuildingVO inside the envelope
    buildings = []
    
    def walk(obj):
        if isinstance(obj, dict):
            # Check if this dict represents a building
            if obj.get('alias') == 'defaultGame.Communication.VO.dBuildingVO' or 'buildingName_string' in obj:
                buildings.append(obj)
            for k, v in obj.items():
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(envelope)
    print(f"Found {len(buildings)} buildings in envelope.")

    by_name = {}
    for b in buildings:
        name = b.get('buildingName_string') or b.get('buildingName', 'Unknown')
        if name not in by_name:
            by_name[name] = []
        by_name[name].append(b)

    print("\nComparing different kinds of mines, deposits, and buildings:")
    for name, list_b in by_name.items():
        sample = list_b[0]
        print(f"\nBuilding: {name} (Count: {len(list_b)})")
        print(f"  buildingMode: {sample.get('buildingMode')}")
        print(f"  isBought: {sample.get('isBought')}")
        print(f"  isProductionActive: {sample.get('isProductionActive')}")
        print(f"  upgradeLevel: {sample.get('upgradeLevel')}")
        print(f"  upgradeIsInProgress: {sample.get('upgradeIsInProgress')}")
        print(f"  level: {sample.get('level')}")
        print(f"  campType: {sample.get('campType')}")
        print(f"  origin: {sample.get('origin')}")
        print(f"  hitPoints: {sample.get('hitPoints')}")
        # Print all keys
        print(f"  Available keys: {list(sample.keys())}")

if __name__ == "__main__":
    analyze()
