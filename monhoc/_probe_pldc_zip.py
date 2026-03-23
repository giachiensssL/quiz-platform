import struct

with open('Phapluatdaicuong.zip', 'rb') as f:
    data = f.read()

i = 0
count = 0
while True:
    s = data.find(b'PK\x03\x04', i)
    if s < 0 or count >= 12:
        break
    if s + 30 > len(data):
        break

    sig, ver, flag, comp, mt, md, crc, cs, us, fnl, exl = struct.unpack_from('<IHHHHHIIIHH', data, s)
    name = data[s + 30 : s + 30 + fnl]
    print(count, 'pos', s, 'flag', hex(flag), 'comp', comp, 'cs', cs, 'us', us, 'fnl', fnl, 'name', name[:100])

    i = s + 30 + fnl + exl + cs
    count += 1

print('finished')
