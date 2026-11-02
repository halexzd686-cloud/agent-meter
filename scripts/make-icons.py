from PIL import Image, ImageDraw
from pathlib import Path
out=Path('assets');out.mkdir(exist_ok=True)
for name,color in [('tray-light',(239,233,218,255)),('tray-dark',(71,79,56,255))]:
    im=Image.new('RGBA',(32,32),(0,0,0,0));d=ImageDraw.Draw(im)
    for x,y in [(7,14),(16,6),(25,11)]: d.rounded_rectangle((x-1,y,x+1,26),radius=1,fill=color)
    im.save(out/(name+'.png'))
im=Image.new('RGBA',(256,256),(0,0,0,0));d=ImageDraw.Draw(im)
d.rounded_rectangle((6,6,250,250),radius=47,fill=(242,238,230,255))
for x,y in [(65,119),(128,52),(191,88)]: d.rounded_rectangle((x-7,y,x+7,202),radius=7,fill=(94,106,76,255))
im.save(out/'app.png');im.save(out/'app.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])