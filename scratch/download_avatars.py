import os
import urllib.request
import urllib.error

def download_avatars():
    output_dir = r"c:\OSPanel\domains\tso_client\admin\public\images\avatars"
    os.makedirs(output_dir, exist_ok=True)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    print(f"Starting avatar downloads to: {output_dir}")
    
    for i in range(1, 61):
        url = f"https://www.thesettlersonline.ru/sites/default/themes/siedler/images/landing/avatar/{i}.png"
        target_path = os.path.join(output_dir, f"{i}.png")
        
        print(f"Downloading {i}/60: {url}...", end="")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                with open(target_path, 'wb') as f:
                    f.write(response.read())
            print(" Success!")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(" Not Found (404)")
            else:
                print(f" Error: HTTP {e.code}")
        except Exception as e:
            print(f" Error: {str(e)}")

if __name__ == "__main__":
    download_avatars()
