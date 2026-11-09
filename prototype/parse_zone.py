import py3amf
import sys
import json
from py3amf import remoting

def main():
    try:
        with open('debug_zone.amf', 'rb') as f:
            data = f.read()
    except Exception as e:
        print(json.dumps({'error': 'Failed to read debug_zone.amf: ' + str(e)}))
        return

    try:
        msg = remoting.decode(data)
    except Exception as e:
        print(json.dumps({'error': 'Failed to decode AMF: ' + str(e)}))
        return

    buildings = []

    # Traverse the parsed structure to find dBuildingVO objects
    # It should be in msg.bodies[0][1] -> AcknowledgeMessage -> body -> dServerResponse -> data -> dZoneVO -> buildings (ArrayCollection)
    # But since it's deeply nested and might have different class mappings, we can do a recursive search.
    
    def find_buildings(obj):
        if hasattr(obj, '__class__'):
            cls_name = obj.__class__.__name__
            if 'dBuildingVO' in cls_name:
                b = {}
                if hasattr(obj, 'buildingName_string'):
                    b['name'] = getattr(obj, 'buildingName_string')
                if hasattr(obj, 'buildingGrid'):
                    b['grid'] = getattr(obj, 'buildingGrid')
                if hasattr(obj, 'upgradeLevel'):
                    b['level'] = getattr(obj, 'upgradeLevel')
                buildings.append(b)
            else:
                for k in dir(obj):
                    if not k.startswith('_'):
                        try:
                            val = getattr(obj, k)
                            if isinstance(val, (list, dict, py3amf.ASObject)):
                                find_buildings(val)
                            elif hasattr(val, '__class__'):
                                find_buildings(val)
                        except:
                            pass
        elif isinstance(obj, dict):
            for k, val in obj.items():
                if isinstance(val, (list, dict, py3amf.ASObject)):
                    find_buildings(val)
                elif hasattr(val, '__class__'):
                    find_buildings(val)
        elif isinstance(obj, list):
            for val in obj:
                if isinstance(val, (list, dict, py3amf.ASObject)):
                    find_buildings(val)
                elif hasattr(val, '__class__'):
                    find_buildings(val)

    try:
        for body in msg.bodies:
            find_buildings(body[1])
    except Exception as e:
        print(json.dumps({'error': 'Error during search: ' + str(e)}))
        return
        
    print(json.dumps({'buildings': buildings}))

if __name__ == '__main__':
    main()
