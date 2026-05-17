import os
import sys

try:
    from PIL import Image
except ImportError:
    print("PIL (Pillow) is not installed. Installing it now...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "Pillow"], check=True)
    from PIL import Image

def main():
    img_path = r"C:\Users\Cristian Aliaga\.gemini\antigravity\brain\e55361b3-0daf-4b22-825d-f45af5431473\media__1778979148949.png"
    out_dir = r"c:\Users\Cristian Aliaga\Desktop\loscosmicos\cosmica\cosmicagpt\apps\cosmica-app\assets"
    
    if not os.path.exists(img_path):
        print(f"Error: Source image not found at {img_path}")
        return

    img = Image.open(img_path)
    w, h = img.size
    print(f"Original image size: {w}x{h}")

    # The emblem is on the left part of the image.
    # In the uploaded logo:
    # - The left margin is about 8% of width.
    # - The emblem ends at about 48% of width.
    # - Vertically, the emblem is centered. It spans from about 32% to 60% of height.
    # Let's dynamically crop the exact square area containing the emblem.
    # For a 1024x1024 image, the emblem is roughly in the bounding box:
    # Left: 70px (approx 7% of width)
    # Top: 320px (approx 31% of height)
    # Right: 490px (approx 48% of width)
    # Bottom: 610px (approx 60% of height)
    
    # To make it perfectly square, let's find the bounding box of non-black pixels on the left 50% of the image.
    # We convert to grayscale to find non-black bounding box of the emblem.
    gray = img.convert("L")
    
    # Scan left 50% of the image to find the bounding box of the colorful emblem
    min_x = w
    max_x = 0
    min_y = h
    max_y = 0
    
    threshold = 15 # Ignore near-black pixels
    for x in range(int(w * 0.5)):
        for y in range(h):
            val = gray.getpixel((x, y))
            if val > threshold:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

    print(f"Detected emblem bounds: X: ({min_x} to {max_x}), Y: ({min_y} to {max_y})")

    # Add a generous padding around the detected bounds to keep it beautifully balanced
    emblem_w = max_x - min_x
    emblem_h = max_y - min_y
    size = max(emblem_w, emblem_h)
    
    # We want a perfectly square crop centered on the emblem's center
    center_x = min_x + emblem_w // 2
    center_y = min_y + emblem_h // 2
    
    # Add padding (e.g. 15% of size)
    padding = int(size * 0.18)
    crop_size = size + padding * 2
    
    left = max(0, center_x - crop_size // 2)
    top = max(0, center_y - crop_size // 2)
    right = min(w, left + crop_size)
    bottom = min(h, top + crop_size)
    
    # Ensure it stays square
    final_w = right - left
    final_h = bottom - top
    final_size = min(final_w, final_h)
    right = left + final_size
    bottom = top + final_size
    
    print(f"Cropping square bounding box: Left: {left}, Top: {top}, Right: {right}, Bottom: {bottom}")
    cropped = img.crop((left, top, right, bottom))
    
    # Resize cropped emblem to 512x512 and 192x192 for PWA standards
    icon_512 = cropped.resize((512, 512), Image.Resampling.LANCZOS)
    icon_192 = cropped.resize((192, 192), Image.Resampling.LANCZOS)
    
    os.makedirs(out_dir, exist_ok=True)
    
    path_512 = os.path.join(out_dir, "icon-512.png")
    path_192 = os.path.join(out_dir, "icon-192.png")
    
    icon_512.save(path_512, "PNG")
    icon_192.save(path_192, "PNG")
    
    # Also save it to the root directory for absolute reliability (e.g. cosmica-logo.png)
    root_logo_path = r"c:\Users\Cristian Aliaga\Desktop\loscosmicos\cosmica\cosmicagpt\cosmica-logo.png"
    icon_512.save(root_logo_path, "PNG")
    
    print("Logo successfully cropped and updated!")

if __name__ == "__main__":
    main()
