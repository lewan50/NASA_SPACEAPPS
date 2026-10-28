"""Convert NASA SVS CGI Moon Kit 16-bit sources into web-ready assets.

Inputs (downloaded from https://svs.gsfc.nasa.gov/4720, public domain):
  /tmp/lroc_color_16bit_srgb_4k.tif  - LROC WAC color mosaic, 4096x2048, 16-bit sRGB
  /tmp/ldem_16_uint.tif              - LOLA DEM, 5760x2880, 16-bit unsigned elevation

Outputs (into frontend/public/textures):
  lroc_color_4k.jpg - 4096x2048 8-bit JPEG (quality 88)
  ldem_2k.png       - 2880x1440 8-bit grayscale PNG, full-range normalized + dithered
"""
import numpy as np
from PIL import Image

TEXTURES = "C:/Users/Leone/NASA_SPACEAPPS/frontend/public/textures"

# --- 1. Color mosaic: 16-bit -> 8-bit JPEG ---
img = Image.open(r"C:\Users\Leone\AppData\Local\Temp\lroc_color_16bit_srgb_4k.tif")
arr = np.array(img)
print("color:", img.mode, arr.shape, arr.dtype)

if arr.dtype == np.uint16:
    arr8 = (arr >> 8).astype(np.uint8)
elif arr.dtype == np.uint8:
    arr8 = arr
else:
    arr8 = np.clip(arr * 255.0, 0, 255).astype(np.uint8)

Image.fromarray(arr8).save(f"{TEXTURES}/lroc_color_4k.jpg", quality=88, optimize=True)
print("saved lroc_color_4k.jpg", arr8.shape)

# --- 2. DEM: uint16 -> area-downsampled, normalized, dithered 8-bit PNG ---
dem = Image.open(r"C:\Users\Leone\AppData\Local\Temp\ldem_16_uint.tif")
d = np.array(dem).astype(np.float64)
print("dem:", dem.mode, d.shape, d.dtype, "min", d.min(), "max", d.max())

# Area-average downscale 5760x2880 -> 2880x1440 on the float data (before quantizing)
demf = Image.fromarray(d.astype(np.float32), mode="F").resize((2880, 1440), Image.BOX)
df = np.array(demf).astype(np.float64)
span = df.max() - df.min()
df = (df - df.min()) / span  # 0..1

# Ordered-ish dither (uniform +/-0.5 LSB) breaks 8-bit terrace banding on smooth slopes
rng = np.random.default_rng(2026)
noise = (rng.random(df.shape) - 0.5)
q = np.clip(df * 255.0 + noise + 0.5, 0, 255).astype(np.uint8)

Image.fromarray(q, mode="L").save(f"{TEXTURES}/ldem_2k.png", optimize=True)
print("saved ldem_2k.png", q.shape, "elevation span used:", span)
